import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 紐づけ確認
  const { data: link } = await supabase
    .from("parent_links")
    .select("student_id, status")
    .eq("parent_user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!link?.student_id) {
    return NextResponse.json({ linked: false });
  }

  const sid = link.student_id;
  const serviceClient = await createServiceClient();

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const [
    { data: student },
    { data: weekSessions },
    { data: monthSessions },
    { data: mockExams },
    { data: recentActivity },
    { data: parentNote },
    { data: badges },
    { data: activeRoute },
  ] = await Promise.all([
    serviceClient
      .from("students")
      .select("id, name, grade, target_univ, target_faculty, plan, current_level, target_level, subjects, route_strategy, exam_date, xp")
      .eq("id", sid)
      .single(),
    serviceClient
      .from("practice_sessions")
      .select("study_minutes, ended_at")
      .eq("student_id", sid)
      .gte("ended_at", weekAgo.toISOString()),
    serviceClient
      .from("practice_sessions")
      .select("study_minutes")
      .eq("student_id", sid)
      .gte("ended_at", monthStart.toISOString()),
    serviceClient
      .from("mock_exams")
      .select("id, exam_name, exam_date, total_score, total_max, total_deviation, scores")
      .eq("student_id", sid)
      .order("exam_date", { ascending: false })
      .limit(3),
    serviceClient
      .from("activity_feed")
      .select("id, feed_type, title, body, xp_delta, created_at")
      .eq("student_id", sid)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("parent_notes")
      .select("note, preferred_subjects, preferred_weekday_minutes, preferred_holiday_minutes, updated_at")
      .eq("parent_user_id", user.id)
      .eq("student_id", sid)
      .maybeSingle(),
    serviceClient
      .from("xp_events")
      .select("id")
      .eq("student_id", sid),
    serviceClient
      .from("student_routes")
      .select("id, status, books(title, subject)")
      .eq("student_id", sid)
      .eq("status", "in_progress")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!student) return NextResponse.json({ linked: false });

  // 勉強時間集計
  const weekMinutes = (weekSessions ?? []).reduce((s, r) => s + (r.study_minutes ?? 0), 0);
  const monthMinutes = (monthSessions ?? []).reduce((s, r) => s + (r.study_minutes ?? 0), 0);

  // 連続学習日数（直近7日でセッションがある日を数える）
  const activeDays = new Set(
    (weekSessions ?? []).map((r) => new Date(r.ended_at).toDateString())
  ).size;

  const badgeCount = (badges ?? []).length;

  return NextResponse.json({
    linked: true,
    student,
    stats: {
      weekMinutes,
      monthMinutes,
      activeDays,
      badgeCount,
      activityCount: (recentActivity ?? []).length,
    },
    mockExams: mockExams ?? [],
    recentActivity: (recentActivity ?? []).slice(0, 8),
    parentNote: parentNote ?? null,
    activeBook: activeRoute?.books ?? null,
  });
}
