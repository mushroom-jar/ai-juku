import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, target_univ, exam_date, subjects, plan, billing_interval, ai_support_trial_used, ai_juku_trial_used, study_style, available_study_time, biggest_blocker, strength_subjects, weakness_subjects, onboarding_summary, ai_interview_completed_at")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ student, email: user.email });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, grade, target_univ, exam_date } = body;

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("students")
    .update({ name, grade, target_univ, exam_date: exam_date || null })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
