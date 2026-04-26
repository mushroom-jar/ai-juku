import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const serviceClient = await createServiceClient();

  // 自分のコードを取得
  const { data: rc } = await serviceClient
    .from("referral_codes")
    .select("id")
    .eq("student_id", student.id)
    .maybeSingle();

  if (!rc) {
    return NextResponse.json({ invitedCount: 0, convertedCount: 0, pendingCount: 0, issuedCount: 0 });
  }

  const { data: uses } = await serviceClient
    .from("referral_uses")
    .select("converted_at, reward_status")
    .eq("referral_code_id", rc.id);

  const all = uses ?? [];
  const invitedCount = all.length;
  const convertedCount = all.filter((u) => u.converted_at !== null).length;
  const pendingCount = all.filter((u) => u.reward_status === "pending" && u.converted_at !== null).length;
  const issuedCount = all.filter((u) => u.reward_status === "issued").length;

  return NextResponse.json({ invitedCount, convertedCount, pendingCount, issuedCount });
}
