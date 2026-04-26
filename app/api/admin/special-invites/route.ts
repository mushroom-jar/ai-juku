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

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "INV-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET() {
  const user = await requireOrgStaff();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const serviceClient = await createServiceClient();
  const { data: invites } = await serviceClient
    .from("special_invites")
    .select("id, code, plan, free_months, max_uses, used_count, expires_at, status, note, created_at")
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireOrgStaff();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json() as {
    plan: "basic" | "premium";
    free_months: number;
    max_uses: number;
    expires_at?: string | null;
    note?: string;
  };

  const serviceClient = await createServiceClient();

  // コード重複を避けてリトライ
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const { data: existing } = await serviceClient
      .from("special_invites")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();
    if (!existing) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: "コード生成に失敗しました。" }, { status: 500 });

  const { data: invite, error } = await serviceClient
    .from("special_invites")
    .insert({
      code,
      plan: body.plan,
      free_months: body.free_months,
      max_uses: body.max_uses,
      expires_at: body.expires_at || null,
      note: body.note || null,
      created_by_user_id: user.id,
      status: "active",
    })
    .select("id, code, plan, free_months, max_uses, used_count, expires_at, status, note, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite });
}
