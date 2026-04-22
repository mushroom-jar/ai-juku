import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BADGE_DEFINITIONS, computeContinuitySnapshot } from "@/lib/continuity";
import { getQuestionLimit } from "@/lib/plans";
import { calcLevel } from "@/lib/levels";

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split("T")[0];
    }),
  };
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
    .select("id, name, plan, subjects, exam_date, target_univ, xp")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const today = new Date().toISOString().split("T")[0];
  const { start, end, days } = getWeekRange();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: schedules } = await supabase
    .from("weekly_schedules")
    .select("id, is_repeat")
    .eq("student_id", student.id)
    .gte("week_start", start)
    .lte("week_start", end);

  const scheduleIds = (schedules ?? []).map((schedule: { id: string }) => schedule.id);
  const isRepeatWeek = (schedules ?? []).some((schedule: { is_repeat: boolean }) => schedule.is_repeat);

  let allTasks: {
    id: string;
    date: string;
    status: string;
    task_type: string;
    problem_no_start: number;
    problem_no_end: number;
    books: { title: string; subject: string } | null;
  }[] = [];

  if (scheduleIds.length > 0) {
    const { data: tasks } = await supabase
      .from("daily_tasks")
      .select("id, date, status, task_type, problem_no_start, problem_no_end, books(title, subject)")
      .in("schedule_id", scheduleIds)
      .order("date", { ascending: true });

    allTasks = (tasks ?? []) as unknown as typeof allTasks;
  }

  const todayTasks = allTasks.filter((task) => task.date === today);
  const weekTasks = days.map((date) => {
    const tasks = allTasks.filter((task) => task.date === date);
    const done = tasks.filter((task) => task.status === "done").length;
    return { date, tasks, done, total: tasks.length };
  });

  const [{ count: monthlyQuestionCount }, { count: weeklyQuestionCount }] = await Promise.all([
    supabase
      .from("question_logs")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .gte("asked_at", monthStart.toISOString()),
    supabase
      .from("question_logs")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .gte("asked_at", `${start}T00:00:00.000Z`),
  ]);

  const [{ count: totalQuestionCount }, { count: totalPracticeCount }, { data: xpEvents }] = await Promise.all([
    supabase.from("question_logs").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("problem_results").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase
      .from("xp_events")
      .select("created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(365),
  ]);

  const [{ data: freeTasks }, { data: laterTasks }, { data: activityFeed }] = await Promise.all([
    supabase
      .from("free_tasks")
      .select("id, date, title, status, source, task_mode, category, start_time, end_time, event_id")
      .eq("student_id", student.id)
      .eq("task_mode", "scheduled")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("free_tasks")
      .select("id, date, title, status, source, task_mode, category, start_time, end_time, event_id")
      .eq("student_id", student.id)
      .eq("task_mode", "later")
      .order("created_at", { ascending: true }),
    supabase
      .from("activity_feed")
      .select("id, actor_name, feed_type, title, body, xp_delta, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const activityIds = (activityFeed ?? []).map((item: { id: string }) => item.id);
  let reactions: { activity_id: string; student_id: string; reaction: string }[] = [];

  if (activityIds.length > 0) {
    const { data: reactionRows } = await supabase
      .from("activity_reactions")
      .select("activity_id, student_id, reaction")
      .in("activity_id", activityIds);

    reactions = reactionRows ?? [];
  }

  const activityFeedWithReactions = (activityFeed ?? []).map(
    (item: {
      id: string;
      actor_name: string;
      feed_type: string;
      title: string;
      body: string | null;
      xp_delta: number;
      metadata: Record<string, unknown>;
      created_at: string;
    }) => {
      const related = reactions.filter((reaction) => reaction.activity_id === item.id);
      return {
        ...item,
        reaction_count: related.length,
        reacted: related.some(
          (reaction) => reaction.student_id === student.id && reaction.reaction === "cheer"
        ),
      };
    }
  );

  const completedTodoCount = [...(freeTasks ?? []), ...(laterTasks ?? [])].filter(
    (task: { status: string }) => task.status === "done"
  ).length;

  const studyDaysThisWeek = weekTasks.filter((day) => day.done > 0).length;
  const studentLevel = calcLevel(student.xp ?? 0).level;
  const questionLimit = getQuestionLimit(student.plan, studentLevel);
  const monthlyUsed = monthlyQuestionCount ?? 0;
  const monthlyRemaining = questionLimit == null ? null : Math.max(0, questionLimit - monthlyUsed);

  const weeklySummary =
    completedTodoCount + completedStudyCount(weekTasks) === 0
      ? {
          title: "まだ今週の動きは少なめです",
          body: "まずは今日のTodoか学習タスクを1つ完了させて、継続の流れを作りましょう。",
        }
      : studyDaysThisWeek >= 5
        ? {
            title: "かなり良いペースで進められています",
            body: "この調子です。質問や復習も挟みながら、今のリズムを来週につなげていきましょう。",
          }
        : {
            title: "少しずつ前に進めています",
            body: "次は学習タスクかMy先生を使って、迷いを減らしながらもう一歩進めると良さそうです。",
          };

  const continuity = computeContinuitySnapshot({
    activeDateStrings: (xpEvents ?? []).map((event: { created_at: string }) =>
      event.created_at.split("T")[0]
    ),
    questionCount: totalQuestionCount ?? 0,
    practiceCount: totalPracticeCount ?? 0,
    xp: student.xp ?? 0,
  });

  return NextResponse.json({
    student,
    today,
    todayTasks,
    weekTasks,
    hasSchedule: scheduleIds.length > 0,
    isRepeatWeek,
    freeTasks: freeTasks ?? [],
    laterTasks: laterTasks ?? [],
    activityFeed: activityFeedWithReactions,
    usage: {
      monthlyQuestionLimit: questionLimit,
      monthlyQuestionUsed: monthlyUsed,
      monthlyQuestionRemaining: monthlyRemaining,
      weeklyQuestionUsed: weeklyQuestionCount ?? 0,
    },
    weeklyReview: {
      studyDays: studyDaysThisWeek,
      completedStudyTasks: completedStudyCount(weekTasks),
      totalStudyTasks: totalStudyTasksCount(weekTasks),
      completedTodos: completedTodoCount,
      summary: weeklySummary,
    },
    continuity: {
      ...continuity,
      badges: BADGE_DEFINITIONS.map((badge) => ({
        ...badge,
        unlocked: continuity.unlockedBadgeIds.includes(badge.id),
      })),
    },
  });
}

function completedStudyCount(weekTasks: Array<{ done: number }>) {
  return weekTasks.reduce((sum, day) => sum + day.done, 0);
}

function totalStudyTasksCount(weekTasks: Array<{ total: number }>) {
  return weekTasks.reduce((sum, day) => sum + day.total, 0);
}
