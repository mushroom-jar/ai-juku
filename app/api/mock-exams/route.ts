import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { XP_RULES, awardXpAndCreateFeed } from "@/lib/gamification";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, subjects")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bookId = new URL(req.url).searchParams.get("book_id");

  let query = supabase
    .from("mock_exams")
    .select("*")
    .eq("student_id", student.id)
    .order("exam_date", { ascending: false });

  if (bookId) query = query.eq("book_id", bookId);

  const { data: exams } = await query;
  return NextResponse.json({ exams: exams ?? [], subjects: student.subjects });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const { exam_name, exam_date, scores, total_score, total_max, total_deviation, memo, book_id, exam_type } = body;

  if (!exam_name || !exam_date) {
    return NextResponse.json({ error: "exam_name and exam_date are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mock_exams")
    .insert({
      student_id: student.id,
      exam_name,
      exam_date,
      exam_type: exam_type ?? "mock",
      scores: scores ?? {},
      total_score: total_score ?? null,
      total_max: total_max ?? null,
      total_deviation: total_deviation ?? null,
      memo: memo ?? null,
      book_id: book_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const serviceClient = await createServiceClient();
  await awardXpAndCreateFeed({
    supabase: serviceClient,
    studentId: student.id,
    actorName: student.name,
    eventType: "mock_exam_logged",
    xpDelta: XP_RULES.mock_exam_logged,
    summary: `Mock exam logged: ${exam_name}`,
    feedType: "mock_exam_logged",
    title: `${exam_name} を記録`,
    body: total_score && total_max
      ? `${total_score} / ${total_max} で模試結果を保存しました`
      : "模試結果を記録しました",
    sourceTable: "mock_exams",
    sourceId: data.id,
    metadata: {
      exam_date,
      total_score: total_score ?? null,
      total_max: total_max ?? null,
    },
  });

  return NextResponse.json({ exam: data });
}
