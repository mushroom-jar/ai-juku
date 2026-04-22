import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const studyMinutes = Math.max(0, Math.floor(Number(body.studyMinutes ?? 0)));
  if (studyMinutes <= 0) {
    return NextResponse.json({ error: "invalid study minutes" }, { status: 400 });
  }

  const payload = {
    student_id: student.id,
    book_id: body.bookId ?? null,
    session_title: body.title?.trim() ? String(body.title).trim() : null,
    study_minutes: studyMinutes,
    source: "practice",
    started_at: body.startedAt ?? null,
    ended_at: body.endedAt ?? new Date().toISOString(),
    result_summary: body.resultSummary ?? null,
  };

  const service = await createServiceClient();
  const { data, error } = await service.from("practice_sessions").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
