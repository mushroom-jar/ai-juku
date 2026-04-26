import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除く
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET: 自分の招待コードを取得（なければ発行）
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 既存コードを確認
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("id, code")
    .eq("student_id", student.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ code: existing.code });

  // コードを新規発行
  const serviceClient = await createServiceClient();
  let code = generateCode();
  // 衝突チェック（稀だが念のため）
  for (let i = 0; i < 5; i++) {
    const { data: conflict } = await serviceClient
      .from("referral_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!conflict) break;
    code = generateCode();
  }

  await serviceClient
    .from("referral_codes")
    .insert({ code, student_id: student.id });

  return NextResponse.json({ code });
}
