import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ todos: [] });

  const dateParam = new URL(req.url).searchParams.get("date");

  const { data } = await supabase
    .from("todos")
    .select("*")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ todos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("todos")
    .insert({
      student_id: student.id,
      title: body.title,
      category: body.category ?? "today",
      status: "pending",
      date: body.date ?? null,
      repeat_type: body.repeat_type ?? "none",
      completed_dates: [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ todo: data });
}
