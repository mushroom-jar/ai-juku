import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeContinuitySnapshot } from "@/lib/continuity";

function toDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function getWeekKey(value: string) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
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
    .select("id, name, target_univ, exam_date, xp")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const since = new Date();
  since.setDate(since.getDate() - 56);
  since.setHours(0, 0, 0, 0);

  const [
    { data: sessions },
    { data: results },
    { data: questions },
    { count: completedTaskCount },
    { data: exams },
  ] = await Promise.all([
    supabase
      .from("practice_sessions")
      .select("study_minutes, ended_at")
      .eq("student_id", student.id)
      .gte("ended_at", since.toISOString())
      .order("ended_at", { ascending: true }),
    supabase
      .from("problem_results")
      .select("recorded_at, result")
      .eq("student_id", student.id)
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true }),
    supabase
      .from("question_logs")
      .select("asked_at")
      .eq("student_id", student.id)
      .gte("asked_at", since.toISOString())
      .order("asked_at", { ascending: true }),
    supabase
      .from("free_tasks")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("status", "done"),
    supabase
      .from("mock_exams")
      .select("id, exam_name, exam_date, total_score, total_max, total_deviation")
      .eq("student_id", student.id)
      .order("exam_date", { ascending: true }),
  ]);

  const totalStudyMinutes = (sessions ?? []).reduce((sum, session) => sum + (session.study_minutes ?? 0), 0);
  const thisWeekStudyMinutes = (sessions ?? [])
    .filter((session) => session.ended_at >= weekStart.toISOString())
    .reduce((sum, session) => sum + (session.study_minutes ?? 0), 0);
  const thisMonthStudyMinutes = (sessions ?? [])
    .filter((session) => session.ended_at >= monthStart.toISOString())
    .reduce((sum, session) => sum + (session.study_minutes ?? 0), 0);

  const activeDateStrings = [
    ...(sessions ?? []).map((session) => toDateKey(session.ended_at)).filter(Boolean),
    ...(results ?? []).map((result) => toDateKey(result.recorded_at)).filter(Boolean),
  ] as string[];

  const continuity = computeContinuitySnapshot({
    activeDateStrings: Array.from(new Set(activeDateStrings)),
    questionCount: questions?.length ?? 0,
    practiceCount: results?.length ?? 0,
    xp: student.xp ?? 0,
  });

  const studyTimeMap = new Map<string, number>();
  for (const session of sessions ?? []) {
    const key = getWeekKey(session.ended_at);
    studyTimeMap.set(key, (studyTimeMap.get(key) ?? 0) + (session.study_minutes ?? 0));
  }

  const resultMap = new Map<string, { total: number; perfect: number; wrong: number }>();
  for (const result of results ?? []) {
    const key = getWeekKey(result.recorded_at);
    const current = resultMap.get(key) ?? { total: 0, perfect: 0, wrong: 0 };
    current.total += 1;
    if (result.result === "perfect") current.perfect += 1;
    if (result.result === "wrong") current.wrong += 1;
    resultMap.set(key, current);
  }

  const questionMap = new Map<string, number>();
  for (const question of questions ?? []) {
    const key = getWeekKey(question.asked_at);
    questionMap.set(key, (questionMap.get(key) ?? 0) + 1);
  }

  const weekKeys = Array.from(new Set([...studyTimeMap.keys(), ...resultMap.keys(), ...questionMap.keys()]))
    .sort((a, b) => a.localeCompare(b))
    .slice(-8);

  const weeklyTrend = weekKeys.map((week) => {
    const study = studyTimeMap.get(week) ?? 0;
    const result = resultMap.get(week) ?? { total: 0, perfect: 0, wrong: 0 };
    const questionsCount = questionMap.get(week) ?? 0;
    return {
      week,
      studyMinutes: study,
      solved: result.total,
      perfect: result.perfect,
      wrong: result.wrong,
      questions: questionsCount,
    };
  });

  const latestExam = exams?.at(-1) ?? null;
  const firstExam = exams?.[0] ?? null;
  const deviationChange =
    latestExam && firstExam && latestExam.total_deviation != null && firstExam.total_deviation != null && latestExam.id !== firstExam.id
      ? Number((latestExam.total_deviation - firstExam.total_deviation).toFixed(1))
      : null;

  return NextResponse.json({
    student: {
      name: student.name,
      targetUniv: student.target_univ,
      examDate: student.exam_date,
      xp: student.xp ?? 0,
    },
    overview: {
      totalStudyMinutes,
      thisWeekStudyMinutes,
      thisMonthStudyMinutes,
      totalSolved: results?.length ?? 0,
      monthlySolved: (results ?? []).filter((result) => result.recorded_at >= monthStart.toISOString()).length,
      totalQuestions: questions?.length ?? 0,
      monthlyQuestions: (questions ?? []).filter((question) => question.asked_at >= monthStart.toISOString()).length,
      completedTasks: completedTaskCount ?? 0,
    },
    continuity,
    weeklyTrend,
    exams: {
      latest: latestExam,
      recent: (exams ?? []).slice(-5).reverse(),
      count: exams?.length ?? 0,
      deviationChange,
    },
  });
}
