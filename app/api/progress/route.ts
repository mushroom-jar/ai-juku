import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name, subjects, exam_date, target_univ, plan, current_level, target_level")
    .eq("user_id", user.id)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // ── 全 problem_results を取得 ──────────────────────────
  const { data: allResults } = await supabase
    .from("problem_results")
    .select("book_id, problem_no, result, recorded_at, attempt_no")
    .eq("student_id", student.id)
    .order("recorded_at", { ascending: false });

  const results = allResults ?? [];

  // 各問題の最新attempt結果だけに絞る
  const latestMap = new Map<string, { result: string; recorded_at: string; book_id: string; problem_no: number }>();
  for (const r of results) {
    const key = `${r.book_id}:${r.problem_no}`;
    if (!latestMap.has(key)) latestMap.set(key, r);
  }
  const latest = Array.from(latestMap.values());

  // ── 科目別統計 ────────────────────────────────────────
  // book_id → subject のマッピングが必要
  const bookIds = [...new Set(latest.map(r => r.book_id))];
  const { data: books } = await supabase
    .from("books")
    .select("id, title, subject, total_problems")
    .in("id", bookIds);

  const bookMap = new Map((books ?? []).map(b => [b.id, b]));

  type SubjectStat = { perfect: number; unsure: number; checked: number; wrong: number; total: number };
  const subjectStats: Record<string, SubjectStat> = {};

  for (const r of latest) {
    const subj = bookMap.get(r.book_id)?.subject ?? "other";
    if (!subjectStats[subj]) subjectStats[subj] = { perfect: 0, unsure: 0, checked: 0, wrong: 0, total: 0 };
    subjectStats[subj].total++;
    if (r.result === "perfect") subjectStats[subj].perfect++;
    else if (r.result === "unsure") subjectStats[subj].unsure++;
    else if (r.result === "checked") subjectStats[subj].checked++;
    else if (r.result === "wrong") subjectStats[subj].wrong++;
  }

  // ── 教材別集計（弱点・得意分析） ──────────────────────
  type BookStat = { book_id: string; title: string; subject: string; perfect: number; unsure: number; checked: number; wrong: number; total: number };
  const bookStatMap = new Map<string, BookStat>();

  for (const r of latest) {
    const book = bookMap.get(r.book_id);
    if (!book) continue;
    if (!bookStatMap.has(r.book_id)) {
      bookStatMap.set(r.book_id, { book_id: r.book_id, title: book.title, subject: book.subject, perfect: 0, unsure: 0, checked: 0, wrong: 0, total: 0 });
    }
    const s = bookStatMap.get(r.book_id)!;
    s.total++;
    if (r.result === "perfect") s.perfect++;
    else if (r.result === "unsure") s.unsure++;
    else if (r.result === "checked") s.checked++;
    else if (r.result === "wrong") s.wrong++;
  }

  const bookStats = Array.from(bookStatMap.values());

  // 弱点教材：(wrong + unsure) / total が高い順（最低5問以上）
  const weakBooks = bookStats
    .filter(b => b.total >= 5)
    .map(b => ({ ...b, weakRate: Math.round(((b.wrong + b.unsure) / b.total) * 100) }))
    .sort((a, b) => b.weakRate - a.weakRate)
    .slice(0, 5);

  // 得意教材：perfect / total が高い順
  const strongBooks = bookStats
    .filter(b => b.total >= 5)
    .map(b => ({ ...b, masteryRate: Math.round((b.perfect / b.total) * 100) }))
    .sort((a, b) => b.masteryRate - a.masteryRate)
    .slice(0, 3);

  // ── 週次トレンド（過去8週） ────────────────────────────
  const weeklyMap = new Map<string, { perfect: number; wrong: number; unsure: number; checked: number }>();

  for (const r of results) {
    const d = new Date(r.recorded_at);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const key = monday.toISOString().split("T")[0];
    if (!weeklyMap.has(key)) weeklyMap.set(key, { perfect: 0, wrong: 0, unsure: 0, checked: 0 });
    const w = weeklyMap.get(key)!;
    if (r.result === "perfect") w.perfect++;
    else if (r.result === "wrong") w.wrong++;
    else if (r.result === "unsure") w.unsure++;
    else if (r.result === "checked") w.checked++;
  }

  const weeklyTrend = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, counts]) => ({ week, ...counts, total: counts.perfect + counts.wrong + counts.unsure + counts.checked }));

  // ── 達成カレンダー（直近30日） ─────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const startStr = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: schedules } = await supabase
    .from("weekly_schedules").select("id").eq("student_id", student.id);
  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);

  let dailyCalendar: { date: string; done: boolean }[] = [];
  if (scheduleIds.length > 0) {
    const { data: tasks } = await supabase
      .from("daily_tasks").select("date, status")
      .in("schedule_id", scheduleIds).gte("date", startStr)
      .order("date", { ascending: true });
    dailyCalendar = (tasks ?? []).map((t: { date: string; status: string }) => ({
      date: t.date, done: t.status === "done",
    }));
  }

  // ── 連続勉強日数 ──────────────────────────────────────
  const recordedDates = new Set(results.map(r => r.recorded_at.split("T")[0]));
  let streakDays = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const str = d.toISOString().split("T")[0];
    if (recordedDates.has(str)) streakDays++;
    else if (i > 0) break;
  }

  // ── ルート進捗 ─────────────────────────────────────────
  const { data: routes } = await supabase
    .from("student_routes")
    .select("id, status, step_order, books(title, subject, total_problems)")
    .eq("student_id", student.id)
    .order("step_order", { ascending: true });

  // ── サマリー ───────────────────────────────────────────
  const totalRecorded = latest.length;
  const overallPerfect = latest.filter(r => r.result === "perfect").length;
  const overallMastery = totalRecorded > 0 ? Math.round((overallPerfect / totalRecorded) * 100) : 0;

  const thisWeekStart = new Date();
  const wd = thisWeekStart.getDay();
  thisWeekStart.setDate(thisWeekStart.getDate() - (wd === 0 ? 6 : wd - 1));
  const thisWeekStr = thisWeekStart.toISOString().split("T")[0];
  const thisWeekRecorded = results.filter(r => r.recorded_at >= thisWeekStr).length;

  return NextResponse.json({
    student,
    subjectStats,
    weakBooks,
    strongBooks,
    weeklyTrend,
    dailyCalendar,
    streakDays,
    totalRecorded,
    thisWeekRecorded,
    overallMastery,
    routes: routes ?? [],
  });
}
