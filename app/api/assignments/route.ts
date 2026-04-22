import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, books(id, title, subject, total_problems, use_count)")
    .eq("student_id", student.id)
    .order("due_date", { ascending: false });

  return NextResponse.json({ assignments: assignments ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students").select("id, name, school_name").eq("user_id", user.id).single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const {
    title, subject, due_date, status, score, max_score, memo,
    // 仮想の本オプション
    create_book = false,
    total_problems = 0,
    problem_labels = [],
    description,
  } = body;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  // 仮想の本を作成（学校プリント課題の場合）
  let book_id: string | null = null;
  if (create_book) {
    const { data: book, error: bookError } = await supabase
      .from("books")
      .insert({
        title,
        subject: subject || "other",
        category: "課題プリント",
        level: 1,
        level_label: "課題",
        publisher: "",
        source: "school",
        school_name: student.school_name ?? null,
        registered_by: student.id,
        total_problems: Number(total_problems) || 0,
        due_date: due_date || null,
        problem_labels,
        description: description || memo || null,
      })
      .select("id")
      .single();

    if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500 });
    book_id = book.id;
  }

  // 課題レコードを作成
  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      student_id: student.id,
      title,
      subject: subject || null,
      due_date: due_date || null,
      status: status || "pending",
      score: score != null ? Number(score) : null,
      max_score: max_score != null ? Number(max_score) : null,
      memo: memo || null,
      book_id,
    })
    .select("*, books(id, title, subject, total_problems)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 期限日を free_tasks にも自動登録
  if (due_date) {
    await supabase.from("free_tasks").insert({
      student_id: student.id,
      date: due_date,
      title: `📋 ${title}`,
      status: "pending",
      source: "user",
    });
  }

  return NextResponse.json({ assignment });
}
