import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

async function getStudentForSession(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return { supabase, error: NextResponse.json({ error: "not found" }, { status: 404 }) };

  const { data: session } = await supabase
    .from("chat_sessions").select("id")
    .eq("id", sessionId).eq("student_id", student.id).single();
  if (!session) return { supabase, error: NextResponse.json({ error: "session not found" }, { status: 404 }) };

  return { supabase, student, error: null };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { supabase, error } = await getStudentForSession(id);
  if (error) return error;

  const { data: messages, error: dbErr } = await supabase
    .from("chat_messages")
    .select("id, role, content, kind, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ messages: messages ?? [] });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { supabase, student, error } = await getStudentForSession(id);
  if (error || !student) return error ?? NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { title?: string };
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error: dbErr } = await supabase
    .from("chat_sessions")
    .update({ title: body.title.trim() })
    .eq("id", id).eq("student_id", student.id)
    .select().single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { supabase, student, error } = await getStudentForSession(id);
  if (error || !student) return error ?? NextResponse.json({ error: "not found" }, { status: 404 });

  const { error: dbErr } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id).eq("student_id", student.id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
