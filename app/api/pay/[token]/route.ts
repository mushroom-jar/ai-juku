import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, target_univ, plan, premium_until")
    .eq("payment_token", token)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // プラン状態の判定（まとめ払い期限切れを考慮）
  const isPremiumActive =
    student.plan === "premium" &&
    (student.premium_until === null || new Date(student.premium_until) > new Date());

  return NextResponse.json({
    name: student.name,
    grade: student.grade,
    targetUniv: student.target_univ,
    currentPlan: isPremiumActive ? "premium" : student.plan,
  });
}
