import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 生徒が組織に所属しているか確認
  const { data: orgStudent } = await supabase
    .from("organization_students")
    .select("id")
    .eq("organization_id", member.organization_id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!orgStudent) return NextResponse.json({ error: "student not in org" }, { status: 403 });

  const serviceClient = await createServiceClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { data: student },
    { data: weekSessions },
    { data: monthSessions },
    { data: mockExams },
    { data: routes },
    { data: recentActivity },
    { data: staffNote },
  ] = await Promise.all([
    serviceClient
      .from("students")
      .select("id, name, grade, target_univ, target_faculty, exam_type, plan, current_level, target_level, subjects, subject_levels, route_strategy, exam_date, xp, study_style, biggest_blocker, strength_subjects, weakness_subjects, onboarding_summary")
      .eq("id", studentId)
      .single(),
    serviceClient
      .from("practice_sessions")
      .select("study_minutes, ended_at")
      .eq("student_id", studentId)
      .gte("ended_at", weekAgo.toISOString()),
    serviceClient
      .from("practice_sessions")
      .select("study_minutes")
      .eq("student_id", studentId)
      .gte("ended_at", monthStart.toISOString()),
    serviceClient
      .from("mock_exams")
      .select("id, exam_name, exam_date, total_score, total_max, total_deviation, scores")
      .eq("student_id", studentId)
      .order("exam_date", { ascending: false })
      .limit(5),
    serviceClient
      .from("student_routes")
      .select("id, step_order, status, books(title, subject, level)")
      .eq("student_id", studentId)
      .order("step_order", { ascending: true })
      .limit(10),
    serviceClient
      .from("activity_feed")
      .select("id, feed_type, title, body, xp_delta, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    serviceClient
      .from("staff_notes")
      .select("id, note, author_user_id, created_at, updated_at")
      .eq("organization_id", member.organization_id)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  ]);

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const weekMinutes = (weekSessions ?? []).reduce((s, r) => s + r.study_minutes, 0);
  const monthMinutes = (monthSessions ?? []).reduce((s, r) => s + r.study_minutes, 0);

  return NextResponse.json({
    student,
    stats: { weekMinutes, monthMinutes },
    mockExams: mockExams ?? [],
    routes: (routes ?? []) as unknown as typeof routes,
    recentActivity: recentActivity ?? [],
    staffNotes: staffNote ?? [],
  });
}
