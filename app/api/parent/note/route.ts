import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: link } = await supabase
    .from("parent_links")
    .select("student_id")
    .eq("parent_user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!link?.student_id) return NextResponse.json({ note: null });

  const { data } = await supabase
    .from("parent_notes")
    .select("*")
    .eq("parent_user_id", user.id)
    .eq("student_id", link.student_id)
    .maybeSingle();

  return NextResponse.json({ note: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: link } = await supabase
    .from("parent_links")
    .select("student_id")
    .eq("parent_user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!link?.student_id) return NextResponse.json({ error: "not linked" }, { status: 400 });

  const body = await req.json() as {
    note?: string;
    preferred_subjects?: string[];
    preferred_weekday_minutes?: number;
    preferred_holiday_minutes?: number;
  };

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("parent_notes")
    .upsert(
      {
        parent_user_id: user.id,
        student_id: link.student_id,
        note: body.note,
        preferred_subjects: body.preferred_subjects,
        preferred_weekday_minutes: body.preferred_weekday_minutes,
        preferred_holiday_minutes: body.preferred_holiday_minutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "parent_user_id,student_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
