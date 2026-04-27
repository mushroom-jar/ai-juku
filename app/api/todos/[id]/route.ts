import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const serviceClient = await createServiceClient();

  // 繰り返しタスクの日付別完了トグル
  if (body.toggle_date) {
    const { data: todo } = await supabase.from("todos").select("completed_dates").eq("id", id).single();
    if (!todo) return NextResponse.json({ error: "not found" }, { status: 404 });
    const dates: string[] = todo.completed_dates ?? [];
    const already = dates.includes(body.toggle_date);
    const next = already
      ? dates.filter((d: string) => d !== body.toggle_date)
      : [...dates, body.toggle_date];
    const { error } = await serviceClient.from("todos").update({ completed_dates: next }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, completed: !already });
  }

  const { error } = await serviceClient.from("todos").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient.from("todos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
