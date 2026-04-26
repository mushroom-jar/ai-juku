import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET: 自分のリンク取得
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("parent_links")
    .select("id, student_id, invited_email, status")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ link: data });
}

// POST: 子どものメールで紐づけ（MVPは即accepted）
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { childEmail } = await req.json() as { childEmail?: string };
  if (!childEmail) return NextResponse.json({ error: "childEmail required" }, { status: 400 });

  const serviceClient = await createServiceClient();

  // メールアドレスから auth user を探す
  const { data: authUsers } = await serviceClient.auth.admin.listUsers();
  const childUser = authUsers?.users?.find((u) => u.email === childEmail);
  if (!childUser) {
    return NextResponse.json({ error: "該当するアカウントが見つかりません" }, { status: 404 });
  }

  // そのユーザーの student レコードを探す
  const { data: student } = await serviceClient
    .from("students")
    .select("id")
    .eq("user_id", childUser.id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "生徒アカウントが見つかりません" }, { status: 404 });
  }

  // 既存リンク確認
  const { data: existing } = await supabase
    .from("parent_links")
    .select("id")
    .eq("parent_user_id", user.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "すでに連携済みです" }, { status: 409 });
  }

  const { error } = await serviceClient.from("parent_links").insert({
    parent_user_id: user.id,
    student_id: student.id,
    invited_email: childEmail,
    status: "accepted",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, studentId: student.id });
}
