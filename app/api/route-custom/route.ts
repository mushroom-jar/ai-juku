import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — myルートに教材を追加
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { bookId } = await req.json();
  if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });

  // myルートに既に追加済みか確認（AIルートは無視）
  const { data: existing } = await supabase
    .from("student_routes")
    .select("id")
    .eq("student_id", student.id)
    .eq("book_id", bookId)
    .eq("source", "custom")
    .single();
  if (existing) return NextResponse.json({ error: "already added" }, { status: 409 });

  // step_order は custom ルートの末尾に追加
  const { count } = await supabase
    .from("student_routes")
    .select("*", { count: "exact", head: true })
    .eq("student_id", student.id)
    .eq("source", "custom");

  const { data, error } = await supabase
    .from("student_routes")
    .insert({
      student_id: student.id,
      book_id: bookId,
      step_order: (count ?? 0) + 1,
      status: "not_started",
      source: "custom",
    })
    .select("id, step_order, status, source, started_at, completed_at, books(id, title, subject, level, total_problems, source, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

// DELETE — myルートから教材を削除
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { routeId } = await req.json();
  if (!routeId) return NextResponse.json({ error: "routeId required" }, { status: 400 });

  // 本人のカスタムルートか確認
  const { data: route } = await supabase
    .from("student_routes")
    .select("id, source, students!inner(user_id)")
    .eq("id", routeId)
    .single();

  if (!route || (route.students as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (route.source !== "custom") {
    return NextResponse.json({ error: "cannot delete AI route" }, { status: 400 });
  }

  const { error } = await supabase.from("student_routes").delete().eq("id", routeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
