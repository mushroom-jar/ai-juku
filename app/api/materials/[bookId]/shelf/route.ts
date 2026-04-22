import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { bookId } = await params;

  // 既に追加済みなら何もしない
  const { data: existing } = await supabase
    .from("student_routes")
    .select("id")
    .eq("student_id", student.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, already: true });

  // 最大 step_order を取得して +1
  const { data: last } = await supabase
    .from("student_routes")
    .select("step_order")
    .eq("student_id", student.id)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.step_order ?? 0) + 1;

  const { error } = await supabase
    .from("student_routes")
    .insert({
      student_id: student.id,
      book_id: bookId,
      step_order: nextOrder,
      status: "not_started",
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
