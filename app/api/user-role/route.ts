import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type AppRole = "student" | "parent" | "org_staff";

function normalizeRole(value: unknown): AppRole {
  return value === "parent" || value === "org_staff" ? value : "student";
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const role = normalizeRole(user.user_metadata?.role);

  const { error: roleError } = await serviceClient
    .from("user_roles")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id" });

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  if (role === "org_staff") {
    const { data: existingMember } = await serviceClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingMember) {
      const orgName =
        typeof user.user_metadata?.org_name === "string" && user.user_metadata.org_name.trim()
          ? user.user_metadata.org_name.trim()
          : "新しい組織";
      const orgType = user.user_metadata?.org_type === "school" ? "school" : "cram_school";

      const { data: organization, error: orgError } = await serviceClient
        .from("organizations")
        .insert({ name: orgName, type: orgType })
        .select("id")
        .single();

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 500 });
      }

      if (organization) {
        const { error: memberError } = await serviceClient
          .from("organization_members")
          .insert({
            organization_id: organization.id,
            user_id: user.id,
            role: "admin",
          });

        if (memberError) {
          return NextResponse.json({ error: memberError.message }, { status: 500 });
        }
      }
    }
  }

  // 生徒ロールの場合: student レコードが未作成なら最小構成で作る
  if (role === "student") {
    const { data: existing } = await serviceClient
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const nameFromMeta = typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
        ? user.user_metadata.name.trim()
        : "ゲスト";

      await serviceClient.from("students").insert({
        user_id: user.id,
        name: nameFromMeta,
        plan: "free",
        grade: 3,
        subjects: [],
      });
    }
  }

  return NextResponse.json({ ok: true, role });
}
