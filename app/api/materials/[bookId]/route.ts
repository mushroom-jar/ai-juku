import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { bookId } = await params;

  // 教材情報
  const { data: book } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single();

  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 問題ごとの正解率集計（公開されている problem_results を集計）
  const { data: results } = await supabase
    .from("problem_results")
    .select("problem_no, result, student_id")
    .eq("book_id", bookId);

  // 問題番号ごとに集計
  const problemStats: Record<number, { total: number; correct: number; wrong: number; partial: number }> = {};
  const uniqueStudents = new Set<string>();
  for (const r of results ?? []) {
    uniqueStudents.add(r.student_id);
    if (!problemStats[r.problem_no]) {
      problemStats[r.problem_no] = { total: 0, correct: 0, wrong: 0, partial: 0 };
    }
    problemStats[r.problem_no].total++;
    if (r.result === "perfect") problemStats[r.problem_no].correct++;
    else if (r.result === "wrong") problemStats[r.problem_no].wrong++;
    else problemStats[r.problem_no].partial++;
  }

  // レビュー（students.name は RLS の関係でサブクエリで取得）
  const { data: reviews } = await supabase
    .from("material_reviews")
    .select("id, rating, difficulty, comment, created_at, student_id, students(name)")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  // 現在のユーザーのレビュー確認
  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();

  const myReview = reviews?.find(r => r.student_id === student?.id) ?? null;

  // 公開演習記録
  const { data: publicExercises } = await supabase
    .from("exercise_records")
    .select("id, date, subject, material, range, question_count, correct_count, duration, user_id")
    .eq("book_id", bookId)
    .eq("is_public", true)
    .order("date", { ascending: false })
    .limit(20);

  // 自分が本棚に追加済みか
  const { data: shelf } = student ? await supabase
    .from("student_routes")
    .select("id")
    .eq("student_id", student.id)
    .eq("book_id", bookId)
    .maybeSingle() : { data: null };

  return NextResponse.json({
    book,
    stats: {
      totalStudents: uniqueStudents.size,
      problemStats,
    },
    reviews: reviews ?? [],
    myReview,
    publicExercises: publicExercises ?? [],
    inShelf: !!shelf,
    myStudentId: student?.id ?? null,
  });
}
