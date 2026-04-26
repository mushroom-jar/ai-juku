import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code?: string };
  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: "コードを入力してください。" });
  }

  const supabase = await createServiceClient();
  const { data: invite } = await supabase
    .from("special_invites")
    .select("id, plan, free_months, max_uses, used_count, expires_at, status")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ valid: false, error: "招待コードが見つかりません。" });
  }
  if (invite.status !== "active") {
    return NextResponse.json({ valid: false, error: "このコードは無効です。" });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: "このコードは有効期限が切れています。" });
  }
  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ valid: false, error: "このコードは使用上限に達しています。" });
  }

  return NextResponse.json({
    valid: true,
    invite_id: invite.id,
    plan: invite.plan,
    free_months: invite.free_months,
  });
}
