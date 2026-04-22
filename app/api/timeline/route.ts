import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getWeekStartIso() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

async function getFriendIds(supabase: Awaited<ReturnType<typeof createClient>>, studentId: string) {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${studentId},addressee_id.eq.${studentId}`);

  return Array.from(
    new Set(
      (data ?? []).map((row) => (row.requester_id === studentId ? row.addressee_id : row.requester_id))
    )
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name, target_univ")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const scopeParam = new URL(req.url).searchParams.get("scope");
  const scope = scopeParam === "friends" ? "friends" : scopeParam === "self" ? "self" : "all";
  const friendIds = await getFriendIds(supabase, student.id);
  const visibleStudentIds = scope === "friends" ? friendIds : scope === "self" ? [student.id] : [];

  let activityQuery = supabase
    .from("activity_feed")
    .select("id, student_id, actor_name, feed_type, title, body, xp_delta, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (scope === "friends" || scope === "self") {
    if (visibleStudentIds.length === 0) {
      activityQuery = supabase.from("activity_feed").select("id, student_id, actor_name, feed_type, title, body, xp_delta, metadata, created_at").limit(0);
    } else {
      activityQuery = activityQuery.in("student_id", visibleStudentIds);
    }
  }

  const { data: activityFeed } = await activityQuery;
  const activityIds = (activityFeed ?? []).map((item) => item.id);
  let reactions: { activity_id: string; student_id: string; reaction: string }[] = [];

  if (activityIds.length > 0) {
    const { data: reactionRows } = await supabase
      .from("activity_reactions")
      .select("activity_id, student_id, reaction")
      .in("activity_id", activityIds);
    reactions = reactionRows ?? [];
  }

  const activityFeedWithReactions = (activityFeed ?? []).map((item) => {
    const related = reactions.filter((reaction) => reaction.activity_id === item.id);
    return {
      ...item,
      reaction_count: related.length,
      reacted: related.some((reaction) => reaction.student_id === student.id && reaction.reaction === "cheer"),
    };
  });

  const weekStartIso = getWeekStartIso();
  let sessionsQuery = supabase
    .from("practice_sessions")
    .select("student_id, study_minutes, students(name)")
    .gte("ended_at", weekStartIso)
    .order("ended_at", { ascending: false });

  if (scope === "friends" || scope === "self") {
    if (visibleStudentIds.length === 0) {
      sessionsQuery = supabase.from("practice_sessions").select("student_id, study_minutes, students(name)").limit(0);
    } else {
      sessionsQuery = sessionsQuery.in("student_id", visibleStudentIds);
    }
  }

  const { data: sessions } = await sessionsQuery;

  const rankingMap = new Map<string, { studentId: string; name: string; totalMinutes: number }>();
  for (const row of sessions ?? []) {
    const studentId = row.student_id as string;
    const studentName = Array.isArray(row.students)
      ? row.students[0]?.name
      : (row.students as { name?: string } | null)?.name;
    const current = rankingMap.get(studentId) ?? {
      studentId,
      name: studentName || "匿名ユーザー",
      totalMinutes: 0,
    };
    current.totalMinutes += row.study_minutes as number;
    rankingMap.set(studentId, current);
  }

  const ranking = Array.from(rankingMap.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const myRanking = ranking.find((entry) => entry.studentId === student.id) ?? null;

  const { data: mySessions } = await supabase
    .from("practice_sessions")
    .select("id, session_title, study_minutes, source, started_at, ended_at, book_id, books(title, subject)")
    .eq("student_id", student.id)
    .order("ended_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    student: {
      name: student.name,
      target_univ: student.target_univ,
    },
    scope,
    friendCount: friendIds.length,
    activityFeed: activityFeedWithReactions,
    practiceSessions: (mySessions ?? []).map((session) => ({
      id: session.id,
      title: session.session_title,
      studyMinutes: session.study_minutes,
      source: session.source,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      bookId: session.book_id,
      bookTitle: Array.isArray(session.books) ? session.books[0]?.title ?? null : (session.books as { title?: string; subject?: string } | null)?.title ?? null,
      subject: Array.isArray(session.books) ? session.books[0]?.subject ?? null : (session.books as { title?: string; subject?: string } | null)?.subject ?? null,
    })),
    studyRanking: ranking.slice(0, 8),
    myRanking,
  });
}
