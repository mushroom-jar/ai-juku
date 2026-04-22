import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let eventsQuery = supabase
    .from("personal_events")
    .select("*")
    .eq("student_id", student.id)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  let sessionsQuery = supabase
    .from("practice_sessions")
    .select("study_minutes, ended_at")
    .eq("student_id", student.id)
    .order("ended_at", { ascending: true });

  if (from) {
    eventsQuery = eventsQuery.gte("date", from);
    sessionsQuery = sessionsQuery.gte("ended_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    eventsQuery = eventsQuery.lte("date", to);
    sessionsQuery = sessionsQuery.lte("ended_at", `${to}T23:59:59.999Z`);
  }

  const [{ data: events }, { data: sessions }] = await Promise.all([eventsQuery, sessionsQuery]);

  const studyMinutesByDate = (sessions ?? []).reduce<Record<string, number>>((acc, session) => {
    const date = session.ended_at?.slice(0, 10);
    if (!date) return acc;
    acc[date] = (acc[date] ?? 0) + (session.study_minutes ?? 0);
    return acc;
  }, {});

  return NextResponse.json({ events: events ?? [], studyMinutesByDate });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { title, date, start_time, end_time, event_type, notes } = await req.json();
  if (!title || !date) return NextResponse.json({ error: "title and date required" }, { status: 400 });

  const { data, error } = await supabase
    .from("personal_events")
    .insert({
      student_id: student.id,
      title,
      date,
      start_time: start_time || null,
      end_time: end_time || null,
      event_type: event_type || "other",
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("personal_events").delete().eq("id", id).eq("student_id", student.id);

  return NextResponse.json({ ok: true });
}
