import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BADGE_DEFINITIONS, computeContinuitySnapshot } from "@/lib/continuity";

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
    .select("id, xp")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [{ count: questionCount }, { count: practiceCount }, { data: xpEvents }] = await Promise.all([
    supabase.from("question_logs").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("problem_results").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase
      .from("xp_events")
      .select("created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(365),
  ]);

  const continuity = computeContinuitySnapshot({
    activeDateStrings: (xpEvents ?? []).map((event: { created_at: string }) => event.created_at.split("T")[0]),
    questionCount: questionCount ?? 0,
    practiceCount: practiceCount ?? 0,
    xp: student.xp ?? 0,
  });

  const badges = BADGE_DEFINITIONS.map((badge) => ({
    ...badge,
    unlocked: continuity.unlockedBadgeIds.includes(badge.id),
  }));

  return NextResponse.json({ continuity, badges });
}
