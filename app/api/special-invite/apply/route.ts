import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await req.json() as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: "コードを入力してください。" }, { status: 400 });

  const serviceClient = await createServiceClient();

  // コード検証
  const { data: invite } = await serviceClient
    .from("special_invites")
    .select("id, plan, free_months, max_uses, used_count, expires_at, status")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!invite || invite.status !== "active") {
    return NextResponse.json({ error: "招待コードが無効です。" }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "招待コードの有効期限が切れています。" }, { status: 400 });
  }
  if (invite.used_count >= invite.max_uses) {
    return NextResponse.json({ error: "招待コードの使用上限に達しています。" }, { status: 400 });
  }

  // 既に使用済みか確認
  const { data: alreadyUsed } = await serviceClient
    .from("special_invite_uses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (alreadyUsed) {
    return NextResponse.json({ error: "すでに招待コードを使用しています。" }, { status: 409 });
  }

  // student レコードを取得または作成
  let { data: student } = await serviceClient
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student) {
    const nameFromMeta =
      typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
        ? user.user_metadata.name.trim()
        : (user.email ?? "ゲスト");
    const { data: created } = await serviceClient
      .from("students")
      .insert({ user_id: user.id, name: nameFromMeta, plan: "free", grade: 3, subjects: [] })
      .select("id")
      .single();
    if (!created) return NextResponse.json({ error: "アカウントの準備に失敗しました。" }, { status: 500 });
    student = created;
  }

  // 無料期間を計算
  const grantedUntil = new Date();
  grantedUntil.setMonth(grantedUntil.getMonth() + invite.free_months);

  // student のプラン更新
  await serviceClient
    .from("students")
    .update({
      plan: invite.plan,
      premium_until: grantedUntil.toISOString(),
      plan_source: "special_invite",
      onboarding_done: true,
    })
    .eq("id", student.id);

  // 使用履歴を保存
  await serviceClient.from("special_invite_uses").insert({
    special_invite_id: invite.id,
    student_id: student.id,
    user_id: user.id,
    granted_plan: invite.plan,
    granted_until: grantedUntil.toISOString(),
  });

  // 使用回数をインクリメント
  await serviceClient
    .from("special_invites")
    .update({ used_count: invite.used_count + 1, updated_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({
    ok: true,
    plan: invite.plan,
    granted_until: grantedUntil.toISOString(),
    free_months: invite.free_months,
  });
}
