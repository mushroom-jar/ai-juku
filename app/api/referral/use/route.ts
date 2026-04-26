import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// 招待コードを使用済みに記録（登録直後に呼ばれる）
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = (await req.json()) as { code?: string };
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const serviceClient = await createServiceClient();

  // コードを検索
  const { data: rc } = await serviceClient
    .from("referral_codes")
    .select("id, student_id")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (!rc) return NextResponse.json({ error: "invalid code" }, { status: 404 });

  // 自己招待は不可
  const { data: self } = await serviceClient
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (self && self.id === rc.student_id) {
    return NextResponse.json({ error: "self referral not allowed" }, { status: 400 });
  }

  // 既に記録済みなら何もしない
  const { data: existing } = await serviceClient
    .from("referral_uses")
    .select("id")
    .eq("referred_user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true });

  await serviceClient.from("referral_uses").insert({
    referral_code_id: rc.id,
    referrer_student_id: rc.student_id,
    referred_user_id: user.id,
    converted_at: null,
    reward_status: "pending",
  });

  return NextResponse.json({ ok: true });
}
