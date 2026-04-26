import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST /api/org/students — add student by email
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "not a member" }, { status: 403 });

  const { email } = (await req.json()) as { email?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const serviceClient = await createServiceClient();

  // Find auth user by email
  const { data: { users } } = await serviceClient.auth.admin.listUsers();
  const targetUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!targetUser) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  // Verify they are a student
  const { data: roleRow } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (roleRow?.role !== "student") {
    return NextResponse.json({ error: "このユーザーは生徒ではありません" }, { status: 400 });
  }

  // Find student record
  const { data: student } = await serviceClient
    .from("students")
    .select("id, name")
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "オンボーディングが完了していません" }, { status: 400 });
  }

  // Check not already enrolled
  const { data: existing } = await serviceClient
    .from("organization_students")
    .select("id")
    .eq("organization_id", member.organization_id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "すでに登録済みです" }, { status: 409 });

  await serviceClient
    .from("organization_students")
    .insert({ organization_id: member.organization_id, student_id: student.id });

  return NextResponse.json({ ok: true, studentName: student.name });
}

// DELETE /api/org/students — remove student from org
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "not a member" }, { status: 403 });
  if (member.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

  const { studentId } = (await req.json()) as { studentId?: string };
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const serviceClient = await createServiceClient();
  await serviceClient
    .from("organization_students")
    .delete()
    .eq("organization_id", member.organization_id)
    .eq("student_id", studentId);

  return NextResponse.json({ ok: true });
}
