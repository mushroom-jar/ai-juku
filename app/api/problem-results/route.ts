import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { XP_RULES, awardXpAndCreateFeed } from "@/lib/gamification";

// POST /api/problem-results — 問題の4段階記録を保存
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id, name").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const { book_id, problem_no, result, attempt_no, sub_no, subsub_no, task_id, memo, image_url } = body;

  if (!book_id || !problem_no || !result) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const safeAttempt  = Math.min(Math.max(parseInt(attempt_no  ?? "1") || 1, 1), 3);
  const safeSub      = Math.max(parseInt(sub_no    ?? "0") || 0, 0);
  const safeSubsub   = Math.max(parseInt(subsub_no ?? "0") || 0, 0);

  const { data, error } = await supabase
    .from("problem_results")
    .upsert({
      student_id: student.id,
      book_id,
      problem_no,
      sub_no:     safeSub,
      subsub_no:  safeSubsub,
      attempt_no: safeAttempt,
      result,
      task_id:    task_id ?? null,
      memo: memo ?? null,
      image_url: image_url ?? null,
      recorded_at: new Date().toISOString(),
    }, { onConflict: "student_id,book_id,problem_no,sub_no,subsub_no,attempt_no" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: book } = await supabase
    .from("books")
    .select("title, subject")
    .eq("id", book_id)
    .single();

  const serviceClient = await createServiceClient();
  const xpDelta = result === "perfect"
    ? XP_RULES.problem_record_perfect
    : XP_RULES.problem_record_any;

  await awardXpAndCreateFeed({
    supabase: serviceClient,
    studentId: student.id,
    actorName: student.name,
    eventType: result === "perfect" ? "problem_record_perfect" : "problem_record_any",
    xpDelta,
    summary: `Problem logged: ${book?.title ?? "Practice"} #${problem_no}`,
    feedType: result === "perfect" ? "practice_perfect" : "practice_logged",
    title: result === "perfect"
      ? `${book?.title ?? "演習"} の ${problem_no} 番をクリア`
      : `${book?.title ?? "演習"} の ${problem_no} 番を記録`,
    body: result === "perfect"
      ? "演習結果が perfect として記録されました"
      : `結果: ${result}`,
    sourceTable: "problem_results",
    sourceId: data.id,
    metadata: {
      book_id,
      book_title: book?.title ?? null,
      subject: book?.subject ?? null,
      problem_no,
      result,
      attempt_no: safeAttempt,
    },
  });

  return NextResponse.json({
    record: data,
    suggest_question: result === "wrong",
    needs_review: result === "unsure" || result === "checked",
  });
}

// GET /api/problem-results?book_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const book_id = searchParams.get("book_id");
  const task_id = searchParams.get("task_id");

  let query = supabase
    .from("problem_results")
    .select("*")
    .eq("student_id", student.id);

  if (book_id) query = query.eq("book_id", book_id);
  if (task_id) query = query.eq("task_id", task_id);

  const { data } = await query
    .order("problem_no",  { ascending: true })
    .order("sub_no",      { ascending: true })
    .order("subsub_no",   { ascending: true });

  const results = data ?? [];
  const summary = {
    perfect: results.filter(r => r.result === "perfect").length,
    unsure:  results.filter(r => r.result === "unsure").length,
    checked: results.filter(r => r.result === "checked").length,
    wrong:   results.filter(r => r.result === "wrong").length,
    total:   results.length,
  };
  const mastery_rate = summary.total > 0
    ? Math.round((summary.perfect / summary.total) * 100) : 0;

  return NextResponse.json({ results, summary, mastery_rate });
}

// DELETE /api/problem-results?book_id=&problem_no=&sub_no=&subsub_no=&attempt_no=
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const book_id   = searchParams.get("book_id");
  const problem_no = searchParams.get("problem_no");
  const sub_no    = searchParams.get("sub_no")    ?? "0";
  const subsub_no = searchParams.get("subsub_no") ?? "0";
  const attempt_no = searchParams.get("attempt_no") ?? "1";

  if (!book_id || !problem_no) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  await supabase
    .from("problem_results")
    .delete()
    .eq("student_id", student.id)
    .eq("book_id", book_id)
    .eq("problem_no", parseInt(problem_no))
    .eq("sub_no",     parseInt(sub_no))
    .eq("subsub_no",  parseInt(subsub_no))
    .eq("attempt_no", parseInt(attempt_no));

  return NextResponse.json({ ok: true });
}
