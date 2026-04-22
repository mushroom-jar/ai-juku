import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { activityId, reaction = "cheer" } = await req.json();
  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("activity_reactions")
    .select("id")
    .eq("activity_id", activityId)
    .eq("student_id", student.id)
    .eq("reaction", reaction)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("activity_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reacted: false });
  }

  const { error } = await supabase
    .from("activity_reactions")
    .insert({
      activity_id: activityId,
      student_id: student.id,
      reaction,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reacted: true });
}
