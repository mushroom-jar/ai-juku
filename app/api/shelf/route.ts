import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 本棚の本一覧
  const { data: shelf } = await supabase
    .from("bookshelf")
    .select("id, book_id, added_at, books(id, title, subject, level, level_label, total_problems, category, cover_url)")
    .eq("student_id", student.id)
    .order("added_at", { ascending: false });

  if (!shelf || shelf.length === 0) return NextResponse.json({ shelf: [] });

  const bookIds = shelf.map(s => s.book_id);

  // 問題結果を集計
  const { data: results } = await supabase
    .from("problem_results")
    .select("book_id, problem_no, result")
    .eq("student_id", student.id)
    .in("book_id", bookIds);

  // book_id ごとに集計
  type Stats = { attempted: Set<number>; perfect: number; unsure: number; checked: number; wrong: number };
  const statsMap = new Map<string, Stats>();
  for (const r of results ?? []) {
    if (!statsMap.has(r.book_id)) {
      statsMap.set(r.book_id, { attempted: new Set(), perfect: 0, unsure: 0, checked: 0, wrong: 0 });
    }
    const s = statsMap.get(r.book_id)!;
    s.attempted.add(r.problem_no);
    if (r.result === "perfect") s.perfect++;
    else if (r.result === "unsure") s.unsure++;
    else if (r.result === "checked") s.checked++;
    else if (r.result === "wrong") s.wrong++;
  }

  const enriched = shelf.map(s => {
    const book = s.books as unknown as { id: string; title: string; subject: string; level: number; level_label: string; total_problems: number; category: string; cover_url: string | null } | null;
    const stats = statsMap.get(s.book_id);
    const attempted = stats?.attempted.size ?? 0;
    const perfect = stats?.perfect ?? 0;
    const total = book?.total_problems ?? 0;
    return {
      id: s.id,
      book_id: s.book_id,
      added_at: s.added_at,
      book,
      stats: {
        attempted,
        perfect,
        unsure: stats?.unsure ?? 0,
        checked: stats?.checked ?? 0,
        wrong: stats?.wrong ?? 0,
        mastery: total > 0 ? Math.round((perfect / total) * 100) : 0,
        coverage: total > 0 ? Math.round((attempted / total) * 100) : 0,
      },
    };
  });

  return NextResponse.json({ shelf: enriched });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { bookId } = await req.json();
  if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("bookshelf")
    .upsert({ student_id: student.id, book_id: bookId }, { onConflict: "student_id,book_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { shelfId } = await req.json();

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  await supabase.from("bookshelf").delete()
    .eq("id", shelfId).eq("student_id", student.id);

  return NextResponse.json({ ok: true });
}
