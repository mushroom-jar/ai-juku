import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 組織メンバー確認
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const serviceClient = await createServiceClient();
  const orgId = member.organization_id;

  const [{ data: org }, { data: orgStudents }] = await Promise.all([
    serviceClient.from("organizations").select("id, name, type").eq("id", orgId).single(),
    serviceClient
      .from("organization_students")
      .select("student_id")
      .eq("organization_id", orgId),
  ]);

  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const studentIds = (orgStudents ?? []).map((r) => r.student_id);

  if (studentIds.length === 0) {
    return NextResponse.json({ org, students: [], memberRole: member.role });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [{ data: students }, { data: sessions }] = await Promise.all([
    serviceClient
      .from("students")
      .select("id, name, grade, target_univ, current_level, xp, subjects")
      .in("id", studentIds),
    serviceClient
      .from("practice_sessions")
      .select("student_id, study_minutes, ended_at")
      .in("student_id", studentIds)
      .gte("ended_at", weekAgo.toISOString()),
  ]);

  // 最終活動日を activity_feed から取得
  const { data: lastActivities } = await serviceClient
    .from("activity_feed")
    .select("student_id, created_at")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  const lastActivityMap = new Map<string, string>();
  for (const a of lastActivities ?? []) {
    if (!lastActivityMap.has(a.student_id)) {
      lastActivityMap.set(a.student_id, a.created_at);
    }
  }

  // 今週の勉強時間を集計
  const weekMinutesMap = new Map<string, number>();
  for (const s of sessions ?? []) {
    weekMinutesMap.set(s.student_id, (weekMinutesMap.get(s.student_id) ?? 0) + s.study_minutes);
  }

  const now = Date.now();
  const enriched = (students ?? []).map((s) => {
    const lastActive = lastActivityMap.get(s.id);
    const daysSinceActive = lastActive
      ? Math.floor((now - new Date(lastActive).getTime()) / 86400000)
      : null;
    const weekMinutes = weekMinutesMap.get(s.id) ?? 0;
    const needsAttention = daysSinceActive !== null && daysSinceActive >= 3;
    return {
      ...s,
      weekMinutes,
      lastActiveAt: lastActive ?? null,
      daysSinceActive,
      needsAttention,
    };
  });

  // 要注意を先頭に
  enriched.sort((a, b) => (b.needsAttention ? 1 : 0) - (a.needsAttention ? 1 : 0));

  return NextResponse.json({ org, students: enriched, memberRole: member.role });
}
