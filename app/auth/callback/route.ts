import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const roleParam = searchParams.get("role") ?? "";
  // OAuth フローで招待コードを URL 経由で受け取る
  const inviteCodeParam = searchParams.get("invite") ?? "";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // パスワードリセット用コードの場合は再設定ページへ
  if (data.session?.user?.recovery_sent_at) {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // ロールを確認（まだなければメタデータまたはクエリパラメータから作成）
  const serviceClient = await createServiceClient();
  let { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow) {
    // OAuth経由のroleParam → user_metadata.role → デフォルト "student" の順で解決
    const rawRole = roleParam || (user.user_metadata?.role as string | undefined) || "student";
    const validRole = ["student", "parent", "org_staff"].includes(rawRole) ? rawRole : "student";

    await serviceClient
      .from("user_roles")
      .upsert({ user_id: user.id, role: validRole }, { onConflict: "user_id", ignoreDuplicates: true });

    // 組織登録の場合は organization + member も作成
    if (validRole === "org_staff") {
      const orgName = (user.user_metadata?.org_name as string | undefined) ?? "新しい教室";
      const orgType = (user.user_metadata?.org_type as string | undefined) ?? "cram_school";

      const { data: org } = await serviceClient
        .from("organizations")
        .insert({ name: orgName, type: orgType })
        .select("id")
        .single();

      if (org) {
        await serviceClient
          .from("organization_members")
          .insert({ organization_id: org.id, user_id: user.id, role: "admin" });
      }
    }

      // student の場合: 最小 student レコードを作成
    if (validRole === "student") {
      const { data: existingStudent } = await serviceClient
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingStudent) {
        const nameFromMeta =
          typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
            ? user.user_metadata.name.trim()
            : (user.email ?? "ゲスト");

        await serviceClient
          .from("students")
          .insert({ user_id: user.id, name: nameFromMeta, plan: "free", grade: 3, subjects: [] });
      }

      // 特別招待コードがあれば適用（URL パラメータ → user_metadata の順で解決）
      const specialInviteCode =
        inviteCodeParam.trim() ||
        (user.user_metadata?.special_invite_code as string | undefined) ||
        "";
      if (specialInviteCode) {
        const { data: invite } = await serviceClient
          .from("special_invites")
          .select("id, plan, free_months, max_uses, used_count, expires_at, status")
          .eq("code", specialInviteCode.trim().toUpperCase())
          .maybeSingle();

        const inviteValid =
          invite &&
          invite.status === "active" &&
          invite.used_count < invite.max_uses &&
          (!invite.expires_at || new Date(invite.expires_at) > new Date());

        if (inviteValid) {
          const { data: alreadyUsed } = await serviceClient
            .from("special_invite_uses")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!alreadyUsed) {
            const { data: student } = await serviceClient
              .from("students")
              .select("id")
              .eq("user_id", user.id)
              .maybeSingle();

            if (student) {
              const grantedUntil = new Date();
              grantedUntil.setMonth(grantedUntil.getMonth() + invite.free_months);

              await serviceClient.from("students").update({
                plan: invite.plan,
                premium_until: grantedUntil.toISOString(),
                plan_source: "special_invite",
                onboarding_done: true,
              }).eq("id", student.id);

              await serviceClient.from("special_invite_uses").insert({
                special_invite_id: invite.id,
                student_id: student.id,
                user_id: user.id,
                granted_plan: invite.plan,
                granted_until: grantedUntil.toISOString(),
              });

              await serviceClient.from("special_invites").update({
                used_count: invite.used_count + 1,
                updated_at: new Date().toISOString(),
              }).eq("id", invite.id);

              return NextResponse.redirect(`${origin}/starter-questions`);
            }
          }
        }
      }
    }

    roleRow = { role: validRole };
  }

  // ロール別リダイレクト
  if (roleRow.role === "parent") {
    return NextResponse.redirect(`${origin}/parent`);
  }
  if (roleRow.role === "org_staff") {
    return NextResponse.redirect(`${origin}/org`);
  }

  // student: 支払い・初期設定の確認
  const { data: student } = await supabase
    .from("students")
    .select("id, onboarding_done, starter_questions_completed_at, ai_interview_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student || !student.onboarding_done) {
    return NextResponse.redirect(`${origin}/billing`);
  }

  if (!student.starter_questions_completed_at && !student.ai_interview_completed_at) {
    return NextResponse.redirect(`${origin}/starter-questions`);
  }

  return NextResponse.redirect(`${origin}/schedule`);
}
