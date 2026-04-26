import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, target_univ, exam_date, subjects, plan, billing_interval, ai_support_trial_used, ai_juku_trial_used, study_style, available_study_time, biggest_blocker, strength_subjects, weakness_subjects, onboarding_summary, ai_interview_completed_at, sensei_personality, payment_token, premium_until, stripe_subscription_id, plan_source")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ student, email: user.email });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    grade?: string;
    target_univ?: string | null;
    exam_date?: string | null;
    sensei_personality?: string;
  };
  const { name, grade, target_univ, exam_date, sensei_personality } = body;

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (grade !== undefined) patch.grade = grade;
  if (target_univ !== undefined) patch.target_univ = target_univ || null;
  if (exam_date !== undefined) patch.exam_date = exam_date || null;
  if (sensei_personality !== undefined) patch.sensei_personality = sensei_personality;

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("students")
    .update(patch)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
