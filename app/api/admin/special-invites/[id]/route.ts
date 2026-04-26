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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireOrgStaff();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { status?: "active" | "inactive" };

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("special_invites")
    .update({ status: body.status ?? "inactive", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
