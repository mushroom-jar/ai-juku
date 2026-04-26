import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getBillingIntervalFromPriceId, getPlanFromPriceId, type StudentPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  // ローカル開発では Stripe CLI が発行するシークレットを優先する
  const webhookSecret =
    (process.env.NODE_ENV !== "production" && process.env.STRIPE_WEBHOOK_SECRET_CLI)
      ? process.env.STRIPE_WEBHOOK_SECRET_CLI
      : process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // ── サブスクリプション変更 ────────────────────────────────────
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    const status = sub.status;
    const priceId = sub.items.data[0]?.price.id ?? "";
    const interval = getBillingIntervalFromPriceId(priceId);
    const isActive = status === "active" || status === "trialing";
    const plan = (isActive ? getPlanFromPriceId(priceId) : "free") as StudentPlan;
    const studentIdFromMeta = (sub.metadata as Record<string, string> | null)?.student_id ?? null;

    const updates: Record<string, unknown> = {
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: status,
      plan,
      billing_interval: interval,
    };

    if (isActive) {
      updates.onboarding_done = true;
      if (plan === "basic") updates.ai_support_trial_used = true;
      if (plan === "premium") updates.ai_juku_trial_used = true;
    }

    // stripe_customer_id で更新し、ヒットしなければ metadata の student_id にフォールバック
    const { data: updatedByCustomer } = await supabase
      .from("students")
      .update(updates)
      .eq("stripe_customer_id", customerId)
      .select("id");

    if ((!updatedByCustomer || updatedByCustomer.length === 0) && studentIdFromMeta) {
      await supabase.from("students").update(updates).eq("id", studentIdFromMeta);
    }
  }

  // ── Checkout セッション完了 ────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};
    const studentId = meta.student_id;
    if (!studentId) return NextResponse.json({ ok: true });

    // サブスク決済完了時: stripe_customer_id が未保存なら保存する
    if (session.mode === "subscription") {
      const checkoutCustomerId = session.customer as string | null;
      if (checkoutCustomerId) {
        await supabase
          .from("students")
          .update({ stripe_customer_id: checkoutCustomerId })
          .eq("id", studentId)
          .is("stripe_customer_id", null);
      }
    }

    // まとめ払い（一括）の処理
    if (session.mode === "payment" && meta.payment_type === "lump_sum") {
      const planKey = (meta.plan_key ?? "premium") as StudentPlan;
      const months = parseInt(meta.months ?? "3", 10);
      const premiumUntil = new Date();
      premiumUntil.setMonth(premiumUntil.getMonth() + months);

      await supabase
        .from("students")
        .update({
          plan: planKey,
          premium_until: premiumUntil.toISOString(),
          onboarding_done: true,
          ...(planKey === "basic" ? { ai_support_trial_used: true } : {}),
          ...(planKey === "premium" ? { ai_juku_trial_used: true } : {}),
        })
        .eq("id", studentId);
    }

    // 紹介転換の記録（サブスク・まとめ払い共通）
    const referralCodeId = meta.referral_code_id;
    const referrerStudentId = meta.referrer_student_id;
    if (referralCodeId && referrerStudentId) {
      const { data: student } = await supabase
        .from("students")
        .select("user_id")
        .eq("id", studentId)
        .maybeSingle();

      if (student?.user_id) {
        const { data: existing } = await supabase
          .from("referral_uses")
          .select("id, converted_at")
          .eq("referred_user_id", student.user_id)
          .maybeSingle();

        if (existing && !existing.converted_at) {
          await supabase
            .from("referral_uses")
            .update({ converted_at: new Date().toISOString(), reward_status: "pending" })
            .eq("id", existing.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
