import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("morning_enabled, morning_time, evening_enabled, evening_time, streak_alert")
    .eq("student_id", student.id)
    .single();

  return NextResponse.json({
    prefs: prefs ?? {
      morning_enabled: false,
      morning_time: "07:00",
      evening_enabled: false,
      evening_time: "21:00",
      streak_alert: false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    morning_enabled?: boolean;
    morning_time?: string;
    evening_enabled?: boolean;
    evening_time?: string;
    streak_alert?: boolean;
  };

  const { error } = await supabase.from("notification_prefs").upsert(
    { student_id: student.id, ...body },
    { onConflict: "student_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
