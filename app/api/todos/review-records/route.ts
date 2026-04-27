import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // needs_review=true の演習記録を取得（直近30件）
  const { data } = await supabase
    .from("exercise_records")
    .select("id, material, range, subject, date, book_id")
    .eq("user_id", user.id)
    .eq("needs_review", true)
    .order("date", { ascending: false })
    .limit(30);

  return NextResponse.json({ records: data ?? [] });
}
