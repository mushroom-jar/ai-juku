import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function studentIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("students").select("id").eq("user_id", userId);
  return data?.map((s: { id: string }) => s.id) ?? [];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const ids = await studentIds(supabase, user.id);

  const { data, error } = await supabase
    .from("assignments")
    .update(body)
    .eq("id", id)
    .in("student_id", ids)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ids = await studentIds(supabase, user.id);

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .in("student_id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
