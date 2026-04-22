import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { calcLevel } from "@/lib/levels";
import { canUseAiJukuLevelPerk, getCheckoutPrice, type BillingInterval, type StudentPlan } from "@/lib/plans";

type CheckoutTier = "basic" | "premium";

function normalizeTier(value: unknown): CheckoutTier {
  if (value === "premium") return "premium";
  if (value === "basic") return "basic";
  return "basic";
}

function normalizeInterval(value: unknown): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, name, stripe_customer_id, stripe_subscription_id, plan, xp, ai_support_trial_used, ai_juku_trial_used")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const tier = normalizeTier(body.planKey ?? body.tier);
  const interval = normalizeInterval(body.interval);
  const targetPlan = getCheckoutPrice(tier, interval);

  if (!targetPlan.priceId) {
    return NextResponse.json({
      error: "price_not_configured",
      message: "このプランのStripe価格IDがまだ設定されていません。",
    }, { status: 400 });
  }

  if (student.stripe_subscription_id && (student.plan as StudentPlan) !== "free") {
    return NextResponse.json({
      error: "existing_subscription",
      message: "既存プランの変更は設定画面から管理してください。",
    }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const currentPlan = (student.plan ?? "free") as StudentPlan;
  const level = calcLevel(student.xp ?? 0).level;

  let customerId = student.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: student.name,
      metadata: { student_id: student.id },
    });
    customerId = customer.id;
    await supabase
      .from("students")
      .update({ stripe_customer_id: customerId })
      .eq("id", student.id);
  }

  let trialPeriodDays: number | undefined;
  if (tier === "basic" && currentPlan === "free" && !student.ai_support_trial_used) {
    trialPeriodDays = 7;
  }
  if (tier === "premium" && currentPlan === "basic" && !student.ai_juku_trial_used && canUseAiJukuLevelPerk(level)) {
    trialPeriodDays = 7;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: targetPlan.priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/billing`,
    subscription_data: {
      ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      metadata: {
        student_id: student.id,
        target_plan: tier,
        billing_interval: interval,
      },
    },
    metadata: {
      student_id: student.id,
      target_plan: tier,
      billing_interval: interval,
    },
  });

  return NextResponse.json({ url: session.url });
}
