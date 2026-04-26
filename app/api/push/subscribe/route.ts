import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  // Upsert by endpoint
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      student_id: student.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { endpoint?: string };
  if (body.endpoint) {
    await supabase.from("push_subscriptions")
      .delete()
      .eq("student_id", student.id)
      .eq("endpoint", body.endpoint);
  } else {
    // Delete all subscriptions for this student
    await supabase.from("push_subscriptions").delete().eq("student_id", student.id);
  }

  return NextResponse.json({ ok: true });
}
