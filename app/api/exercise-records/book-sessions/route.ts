import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ sessions: [] });

  // 教材ごと・日付ごとに集計
  const { data } = await supabase
    .from("problem_results")
    .select("book_id, result, recorded_at, books(id, title, subject)")
    .eq("student_id", student.id)
    .not("recorded_at", "is", null)
    .order("recorded_at", { ascending: false });

  if (!data) return NextResponse.json({ sessions: [] });

  // book_id + date でグループ化
  const map = new Map<string, {
    book_id: string;
    book_title: string;
    subject: string;
    date: string;
    total: number;
    correct: number;
  }>();

  for (const row of data) {
    const book = row.books as unknown as { id: string; title: string; subject: string } | null;
    if (!book || !row.recorded_at) continue;
    const date = (row.recorded_at as string).slice(0, 10);
    const key = `${row.book_id}__${date}`;
    if (!map.has(key)) {
      map.set(key, { book_id: row.book_id, book_title: book.title, subject: book.subject, date, total: 0, correct: 0 });
    }
    const entry = map.get(key)!;
    entry.total += 1;
    if (row.result === "perfect") entry.correct += 1;
  }

  const sessions = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ sessions });
}
