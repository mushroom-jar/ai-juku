import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function weeksUntilExam(examDate: string | null): number {
  if (!examDate) return 52;
  const exam = new Date(examDate);
  const now = new Date();
  const weeks = Math.ceil((exam.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(weeks, 4);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { studentId } = await req.json();

  const { data: student } = await supabase
    .from("students")
    .select("id, user_id, exam_date, subjects")
    .eq("id", studentId)
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const weekStart = getWeekStart(new Date());

  // 重複チェック
  const { data: existing } = await supabase
    .from("weekly_schedules")
    .select("id")
    .eq("student_id", studentId)
    .eq("week_start", weekStart)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, scheduleId: existing.id, already_exists: true });
  }

  // 現在進行中のルートを取得
  const { data: routes } = await supabase
    .from("student_routes")
    .select("*, books(id, title, subject, total_problems)")
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .order("step_order", { ascending: true })
    .limit(1);

  if (!routes || routes.length === 0) {
    return NextResponse.json({ error: "no active route" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const currentRoute = routes[0];
  const book = currentRoute.books as { id: string; title: string; subject: string; total_problems: number };

  // 先週のセッション結果を確認（リピート判定）
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartStr = lastWeekStart.toISOString().split("T")[0];

  const { data: lastSession } = await supabase
    .from("weekly_sessions")
    .select("passed, mastery_rate")
    .eq("student_id", studentId)
    .gte("session_date", lastWeekStartStr)
    .order("session_date", { ascending: false })
    .limit(1)
    .single();

  const { data: lastSchedule } = await supabase
    .from("weekly_schedules")
    .select("range_start, range_end")
    .eq("student_id", studentId)
    .eq("week_start", lastWeekStartStr)
    .single();

  // マスター率80%未満 → 同じ範囲を繰り返す
  const isRepeat = lastSession !== null && lastSession.passed === false;

  let rangeStart: number;
  let rangeEnd: number;

  const totalProblems = book.total_problems || 60;

  if (isRepeat && lastSchedule?.range_start && lastSchedule?.range_end) {
    // 先週と同じ範囲
    rangeStart = lastSchedule.range_start;
    rangeEnd = lastSchedule.range_end;
  } else {
    // 記録済み問題数を取得して次の範囲を決める（最新attempt・sub_no=0のみ）
    const { data: recordedRows } = await supabase
      .from("problem_results")
      .select("problem_no")
      .eq("student_id", studentId)
      .eq("book_id", book.id)
      .eq("sub_no", 0)
      .eq("subsub_no", 0);

    const uniqueProblems = new Set((recordedRows ?? []).map(r => r.problem_no));
    const solvedCount = uniqueProblems.size;

    const weeksLeft = weeksUntilExam(student.exam_date);
    const remaining = Math.max(totalProblems - (solvedCount ?? 0), 1);
    // 月〜木の4日で進む問題数（週の新規分）
    const weeklyNew = Math.ceil(remaining / Math.min(weeksLeft, 12));

    rangeStart = solvedCount + 1;
    rangeEnd = Math.min(rangeStart + weeklyNew - 1, totalProblems);
  }

  const problemsInRange = rangeEnd - rangeStart + 1;
  const perDay = Math.ceil(problemsInRange / 4); // 4日で割る

  // スケジュール作成
  const { data: schedule, error: schedErr } = await serviceClient
    .from("weekly_schedules")
    .insert({
      student_id: studentId,
      week_start: weekStart,
      is_exam_week: false,
    })
    .select()
    .single();

  if (schedErr || !schedule) {
    return NextResponse.json({ error: schedErr?.message }, { status: 500 });
  }

  const tasks = [];

  // ── 月〜木：新範囲を進む ──
  let currentProblemNo = rangeStart;
  for (let i = 0; i < 4; i++) {
    const taskDate = new Date(weekStart);
    taskDate.setDate(taskDate.getDate() + i); // 月=0, 火=1, 水=2, 木=3
    const dateStr = taskDate.toISOString().split("T")[0];

    const start = currentProblemNo;
    const end = Math.min(currentProblemNo + perDay - 1, rangeEnd);
    if (start > rangeEnd) break;

    tasks.push({
      schedule_id: schedule.id,
      date: dateStr,
      book_id: book.id,
      problem_no_start: start,
      problem_no_end: end,
      status: "pending",
    });

    currentProblemNo = end + 1;
  }

  // ── 金・土：今週の範囲を丸ごと復習 ──
  for (let i = 4; i <= 5; i++) {
    const taskDate = new Date(weekStart);
    taskDate.setDate(taskDate.getDate() + i); // 金=4, 土=5
    const dateStr = taskDate.toISOString().split("T")[0];

    tasks.push({
      schedule_id: schedule.id,
      date: dateStr,
      book_id: book.id,
      problem_no_start: rangeStart,
      problem_no_end: rangeEnd,
      status: "pending",
    });
  }

  // ── 日曜：確認テスト（daily_taskは作らず週次セッションで対応） ──

  const { error: taskErr } = await serviceClient
    .from("daily_tasks")
    .insert(tasks);

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    scheduleId: schedule.id,
    tasksCreated: tasks.length,
    rangeStart,
    rangeEnd,
    isRepeat,
  });
}
