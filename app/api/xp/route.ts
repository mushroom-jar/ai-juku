import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeContinuitySnapshot } from "@/lib/continuity";
import { getPlanDisplayName } from "@/lib/plans";
import { getLevelTheme, getNextLevelTheme } from "@/lib/levels";

const XP_TABLE = {
  task_complete: 10,
  task_undo: -10,
  practice_problem: 2,
  record_perfect: 3,
  record_any: 1,
} as const;

export const XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];

export function calcLevel(xp: number): { level: number; current: number; next: number; pct: number } {
  let level = 1;
  for (let i = XP_LEVELS.length - 1; i >= 0; i -= 1) {
    if (xp >= XP_LEVELS[i]) {
      level = i + 1;
      break;
    }
  }

  const current = XP_LEVELS[level - 1] ?? 0;
  const next = XP_LEVELS[level] ?? XP_LEVELS[XP_LEVELS.length - 1];
  const pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { level, current, next, pct };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name, xp, plan, target_univ, exam_date")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [
    { data: xpEvents },
    { count: questionCount },
    { count: practiceCount },
    { count: completedTaskCount },
    { data: studySessions },
  ] = await Promise.all([
    supabase.from("xp_events").select("created_at").eq("student_id", student.id),
    supabase.from("question_logs").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("problem_results").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("free_tasks").select("*", { count: "exact", head: true }).eq("student_id", student.id).eq("status", "done"),
    supabase.from("practice_sessions").select("study_minutes, ended_at").eq("student_id", student.id),
  ]);

  const xp = student.xp ?? 0;
  const continuity = computeContinuitySnapshot({
    activeDateStrings: (xpEvents ?? []).map((item) => item.created_at.slice(0, 10)),
    questionCount: questionCount ?? 0,
    practiceCount: practiceCount ?? 0,
    xp,
  });

  const levelInfo = calcLevel(xp);
  const levelTheme = getLevelTheme(levelInfo.level);
  const nextLevelTheme = getNextLevelTheme(levelInfo.level);
  const totalStudyMinutes = (studySessions ?? []).reduce((sum, session) => sum + (session.study_minutes ?? 0), 0);
  const activeStudyDays = new Set((studySessions ?? []).map((session) => session.ended_at?.slice(0, 10)).filter(Boolean)).size;

  return NextResponse.json({
    xp,
    name: student.name,
    streak: continuity.currentStreak,
    badgeCount: continuity.unlockedBadgeIds.length,
    planLabel: getPlanDisplayName(student.plan ?? "free"),
    targetUniv: student.target_univ ?? null,
    examDate: student.exam_date ?? null,
    totalStudyMinutes,
    totalSolvedProblems: practiceCount ?? 0,
    totalQuestions: questionCount ?? 0,
    completedTasks: completedTaskCount ?? 0,
    activeStudyDays,
    levelTheme,
    nextLevelTheme,
    ...levelInfo,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { action, count = 1 } = await req.json();

  let delta = 0;
  if (action === "task_complete") delta = XP_TABLE.task_complete;
  else if (action === "task_undo") delta = XP_TABLE.task_undo;
  else if (action === "practice") delta = XP_TABLE.practice_problem * count;
  else if (action === "record_perfect") delta = XP_TABLE.record_perfect;
  else if (action === "record_any") delta = XP_TABLE.record_any;
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });

  const { data: student } = await supabase
    .from("students")
    .select("id, xp")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const newXp = Math.max(0, (student.xp ?? 0) + delta);
  await supabase.from("students").update({ xp: newXp }).eq("id", student.id);

  return NextResponse.json({ xp: newXp, delta, ...calcLevel(newXp) });
}
