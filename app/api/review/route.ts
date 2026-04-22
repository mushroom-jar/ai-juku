import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RESULT_ORDER: Record<string, number> = { wrong: 0, unsure: 1, checked: 2 };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // perfect 以外の最新 attempt を取得
  const { data: results, error } = await supabase
    .from("problem_results")
    .select("id, book_id, problem_no, sub_no, subsub_no, attempt_no, result, recorded_at")
    .eq("student_id", student.id)
    .in("result", ["wrong", "unsure", "checked"])
    .order("recorded_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = results ?? [];

  // book情報を一括取得
  const bookIds = [...new Set(rows.map(r => r.book_id))];
  const { data: books } = bookIds.length > 0
    ? await supabase.from("books").select("id, title, subject").in("id", bookIds)
    : { data: [] };

  const bookMap = new Map((books ?? []).map(b => [b.id, b]));

  // 同じ問題で複数attemptある場合は最新のみ残す
  const latestMap = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const key = `${r.book_id}_${r.problem_no}_${r.sub_no}_${r.subsub_no}`;
    const existing = latestMap.get(key);
    if (!existing || r.attempt_no > existing.attempt_no) {
      latestMap.set(key, r);
    }
  }

  const items = [...latestMap.values()]
    .sort((a, b) => {
      const ro = (RESULT_ORDER[a.result] ?? 9) - (RESULT_ORDER[b.result] ?? 9);
      if (ro !== 0) return ro;
      return new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
    })
    .map(r => ({
      ...r,
      book: bookMap.get(r.book_id) ?? null,
    }));

  const summary = {
    wrong:   items.filter(r => r.result === "wrong").length,
    unsure:  items.filter(r => r.result === "unsure").length,
    checked: items.filter(r => r.result === "checked").length,
    total:   items.length,
  };

  return NextResponse.json({ items, summary });
}
