import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { studentId, note } = await req.json() as { studentId?: string; note?: string };
  if (!studentId || !note?.trim()) {
    return NextResponse.json({ error: "studentId and note required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient.from("staff_notes").insert({
    organization_id: member.organization_id,
    student_id: studentId,
    author_user_id: user.id,
    note: note.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { noteId, note } = await req.json() as { noteId?: string; note?: string };
  if (!noteId || !note?.trim()) {
    return NextResponse.json({ error: "noteId and note required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("staff_notes")
    .update({ note: note.trim(), updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("author_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
