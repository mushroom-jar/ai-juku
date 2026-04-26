import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getBillingIntervalFromPriceId, getPlanFromPriceId, type StudentPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sessionId } = await req.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  // Stripe からセッション情報を取得
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch {
    return NextResponse.json({ error: "セッション情報の取得に失敗しました。" }, { status: 400 });
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "決済が完了していません。" }, { status: 402 });
  }

  const meta = (session.metadata ?? {}) as Record<string, string>;
  const studentId = meta.student_id;
  if (!studentId) return NextResponse.json({ ok: true });

  const serviceClient = await createServiceClient();

  // Webhook がすでに処理済みか確認
  const { data: student } = await serviceClient
    .from("students")
    .select("plan, onboarding_done")
    .eq("id", studentId)
    .single();

  if (student && (student.plan as string) !== "free" && student.onboarding_done) {
    return NextResponse.json({ ok: true });
  }

  // Webhook 未着時のフォールバック
  const sub = session.subscription as { id: string; items: { data: Array<{ price: { id: string } }> } } | null;
  const priceId = sub?.items?.data?.[0]?.price?.id ?? "";
  const plan = getPlanFromPriceId(priceId) as StudentPlan;
  const interval = getBillingIntervalFromPriceId(priceId);
  const customerId = session.customer as string | null;

  const updates: Record<string, unknown> = {
    onboarding_done: true,
    plan_source: "paid",
  };
  if (plan !== "free") {
    updates.plan = plan;
    updates.billing_interval = interval;
    if (plan === "basic") updates.ai_support_trial_used = true;
    if (plan === "premium") updates.ai_juku_trial_used = true;
  }
  if (customerId) updates.stripe_customer_id = customerId;
  if (sub?.id) updates.stripe_subscription_id = sub.id;

  await serviceClient.from("students").update(updates).eq("id", studentId);

  return NextResponse.json({ ok: true });
}
