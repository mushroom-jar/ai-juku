import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookId = req.nextUrl.searchParams.get("book_id");
  if (!bookId) return NextResponse.json({ error: "book_id required" }, { status: 400 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 本の情報
  const { data: book } = await supabase
    .from("books")
    .select("id, title, subject, level, level_label, total_problems, category, publisher")
    .eq("id", bookId)
    .single();
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  // 問題結果（最新1件 per problem_no）
  const { data: results } = await supabase
    .from("problem_results")
    .select("problem_no, result, recorded_at")
    .eq("student_id", student.id)
    .eq("book_id", bookId)
    .order("recorded_at", { ascending: false });

  // problem_no ごとに最新の結果のみ残す
  const latestMap = new Map<number, { result: string; recorded_at: string }>();
  for (const r of results ?? []) {
    if (!latestMap.has(r.problem_no)) {
      latestMap.set(r.problem_no, { result: r.result, recorded_at: r.recorded_at });
    }
  }

  // 全履歴（タイムライン用）
  const { data: history } = await supabase
    .from("problem_results")
    .select("problem_no, result, recorded_at")
    .eq("student_id", student.id)
    .eq("book_id", bookId)
    .order("recorded_at", { ascending: false })
    .limit(100);

  // 統計
  const problemResults = Array.from(latestMap.values());
  const counts = { perfect: 0, unsure: 0, checked: 0, wrong: 0 };
  for (const { result } of problemResults) {
    if (result in counts) counts[result as keyof typeof counts]++;
  }
  const attempted = latestMap.size;
  const total = book.total_problems;
  const mastery  = total > 0 ? Math.round((counts.perfect / total) * 100) : 0;
  const coverage = total > 0 ? Math.round((attempted / total) * 100) : 0;

  return NextResponse.json({
    book,
    stats: { ...counts, attempted, mastery, coverage },
    problems: Object.fromEntries(latestMap),   // { [problem_no]: { result, recorded_at } }
    history: history ?? [],
  });
}
