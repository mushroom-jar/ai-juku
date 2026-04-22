import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LEVEL_LABELS: Record<number, string> = {
  1: "基礎・共通テスト",
  2: "標準私大・共通テスト",
  3: "MARCH・関関同立",
  4: "地方国公立・難関私大",
  5: "最難関",
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const level = searchParams.get("level");
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const source = searchParams.get("source");

  const { data: student } = await supabase
    .from("students")
    .select("id, school_name")
    .eq("user_id", user.id)
    .single();

  let query = supabase
    .from("books")
    .select("id, title, subject, level, level_label, total_problems, source, use_count, registered_by, cover_url, category, school_name")
    .order("source", { ascending: true })
    .order("level", { ascending: true })
    .order("use_count", { ascending: false });

  if (subject) query = query.eq("subject", subject);
  if (level) query = query.eq("level", Number(level));
  if (q) query = query.ilike("title", `%${q}%`);
  if (source && source !== "all") query = query.eq("source", source);

  // Normalize "テスト" → "その他" for filtering
  const normalizedCategory = category === "テスト" ? "その他" : category;
  if (normalizedCategory) query = query.eq("category", normalizedCategory);

  const { data: books } = await query;

  const filtered = (books ?? []).filter((book) => {
    if (book.source === "private") return book.registered_by === student?.id;
    if (book.source === "school") {
      return (
        book.registered_by === student?.id ||
        (student?.school_name && book.school_name === student.school_name)
      );
    }
    return true;
  });

  return NextResponse.json({
    books: filtered,
    meta: { school_name: student?.school_name ?? null },
  });
}

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
    .select("id, school_name")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title,
    subject,
    level,
    total_problems,
    cover_url,
    category = "問題集",
    visibility = "school",
  } = body;

  if (!title || !subject || !total_problems) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Determine source from category + visibility
  let source: string;
  let bookSchoolName: string | null = null;
  if (category === "その他") {
    source = visibility === "private" ? "private" : "school";
    if (source === "school") bookSchoolName = student.school_name ?? null;
  } else {
    source = "community";
  }

  const { data: book, error } = await supabase
    .from("books")
    .insert({
      title,
      subject,
      level: level ?? 1,
      level_label: LEVEL_LABELS[level as number] ?? "",
      total_problems,
      source,
      registered_by: student.id,
      category,
      publisher: "",
      cover_url: cover_url ?? null,
      school_name: bookSchoolName,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ book });
}
