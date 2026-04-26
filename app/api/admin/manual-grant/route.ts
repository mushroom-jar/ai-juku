import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function requireOrgStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (role?.role !== "org_staff") return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await requireOrgStaff();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json() as {
    student_id: string;
    plan: "basic" | "premium";
    months: number;
    note?: string;
  };

  if (!body.student_id || !body.plan || !body.months) {
    return NextResponse.json({ error: "必須項目が不足しています。" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const grantedUntil = new Date();
  grantedUntil.setMonth(grantedUntil.getMonth() + body.months);

  // student のプラン更新
  const { error: updateError } = await serviceClient
    .from("students")
    .update({
      plan: body.plan,
      premium_until: grantedUntil.toISOString(),
      plan_source: "manual_grant",
      onboarding_done: true,
    })
    .eq("id", body.student_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // 付与履歴を保存
  await serviceClient.from("manual_plan_grants").insert({
    student_id: body.student_id,
    granted_by_user_id: user.id,
    plan: body.plan,
    granted_until: grantedUntil.toISOString(),
    note: body.note || null,
  });

  return NextResponse.json({ ok: true, granted_until: grantedUntil.toISOString() });
}
