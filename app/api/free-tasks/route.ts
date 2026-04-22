import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { XP_RULES, awardXpAndCreateFeed } from "@/lib/gamification";

const TASK_CATEGORIES = ["club", "test", "lesson", "free", "other"] as const;
const TASK_MODES = ["later", "scheduled"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const {
    title,
    date,
    source = "user",
    task_mode = "later",
    category = "other",
    start_time = null,
    end_time = null,
  } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (!TASK_MODES.includes(task_mode)) {
    return NextResponse.json({ error: "invalid task_mode" }, { status: 400 });
  }

  if (!TASK_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  if (task_mode === "scheduled" && !date) {
    return NextResponse.json({ error: "date is required for scheduled tasks" }, { status: 400 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  let eventId: string | null = null;
  if (task_mode === "scheduled") {
    const { data: event, error: eventError } = await supabase
      .from("personal_events")
      .insert({
        student_id: student.id,
        title: title.trim(),
        date,
        start_time,
        end_time,
        event_type: category,
        notes: "task_sync",
      })
      .select("id")
      .single();

    if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
    eventId = event.id;
  }

  const { data, error } = await supabase
    .from("free_tasks")
    .insert({
      student_id: student.id,
      title: title.trim(),
      date: task_mode === "scheduled" ? date : null,
      source,
      task_mode,
      category,
      start_time: task_mode === "scheduled" ? start_time : null,
      end_time: task_mode === "scheduled" ? end_time : null,
      event_id: eventId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const { data: currentTask } = await supabase
    .from("free_tasks")
    .select("id, title, status, task_mode, category, date")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("free_tasks")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (currentTask && currentTask.status !== status) {
    const serviceClient = await createServiceClient();
    if (status === "done") {
      await awardXpAndCreateFeed({
        supabase: serviceClient,
        studentId: student.id,
        actorName: student.name,
        eventType: "task_complete",
        xpDelta: XP_RULES.task_complete,
        summary: `Todo completed: ${currentTask.title}`,
        feedType: "task_complete",
        title: `${currentTask.title} を完了`,
        body: currentTask.task_mode === "scheduled" && currentTask.date
          ? `${currentTask.date} の予定Todoを完了しました`
          : "あとでやるタスクを完了しました",
        sourceTable: "free_tasks",
        sourceId: currentTask.id,
        metadata: {
          category: currentTask.category,
          task_mode: currentTask.task_mode,
        },
      });
    } else if (currentTask.status === "done" && status === "pending") {
      await awardXpAndCreateFeed({
        supabase: serviceClient,
        studentId: student.id,
        actorName: student.name,
        eventType: "task_undo",
        xpDelta: XP_RULES.task_undo,
        summary: `Todo reopened: ${currentTask.title}`,
        feedType: "task_reopened",
        title: `${currentTask.title} をやり直しに戻した`,
        body: "完了済みのTodoを見直し用に戻しました",
        sourceTable: "free_tasks",
        sourceId: currentTask.id,
        metadata: {
          category: currentTask.category,
          task_mode: currentTask.task_mode,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: task } = await supabase
    .from("free_tasks")
    .select("event_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("free_tasks")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (task?.event_id) {
    await supabase
      .from("personal_events")
      .delete()
      .eq("id", task.event_id);
  }

  return NextResponse.json({ ok: true });
}
