import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getStudent(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("students").select("id").eq("user_id", user.id).single();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const student = await getStudent(supabase);
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const book_id = searchParams.get("book_id");
  const problem_no = searchParams.get("problem_no");
  const sub_no = searchParams.get("sub_no") ?? "0";
  const subsub_no = searchParams.get("subsub_no") ?? "0";

  if (!book_id || !problem_no) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const { data } = await supabase
    .from("problem_notes")
    .select("*")
    .eq("student_id", student.id)
    .eq("book_id", book_id)
    .eq("problem_no", Number(problem_no))
    .eq("sub_no", Number(sub_no))
    .eq("subsub_no", Number(subsub_no))
    .single();

  return NextResponse.json({ note: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const student = await getStudent(supabase);
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { book_id, problem_no, sub_no = 0, subsub_no = 0, memo = "", images = [] } = body;

  const { data, error } = await supabase
    .from("problem_notes")
    .upsert(
      { student_id: student.id, book_id, problem_no, sub_no, subsub_no, memo, images, updated_at: new Date().toISOString() },
      { onConflict: "student_id,book_id,problem_no,sub_no,subsub_no" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}
