import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ books: [] });

  const { data } = await supabase
    .from("exercise_books")
    .select("*")
    .eq("student_id", student.id)
    .order("updated_at", { ascending: false });

  // 演習回数を既存exercise_recordsから集計
  const bookIds = (data ?? []).map(b => b.id);
  const { data: counts } = bookIds.length > 0
    ? await supabase
        .from("exercise_records")
        .select("book_id")
        .in("book_id", bookIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  (counts ?? []).forEach(r => {
    if (r.book_id) countMap[r.book_id] = (countMap[r.book_id] ?? 0) + 1;
  });

  const books = (data ?? []).map(b => ({
    ...b,
    exercise_count: countMap[b.id] ?? 0,
  }));

  return NextResponse.json({ books });
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
    .from("exercise_books")
    .insert({
      student_id: student.id,
      title: body.title,
      subject: body.subject ?? "other",
      total_pages: body.total_pages ?? null,
      current_page: 0,
      cover_color: body.cover_color ?? "#3157B7",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ book: { ...data, exercise_count: 0 } });
}
