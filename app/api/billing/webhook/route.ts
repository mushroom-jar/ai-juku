import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getBillingIntervalFromPriceId, getPlanFromPriceId, type StudentPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

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

    const updates: Record<string, unknown> = {
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

    await supabase
      .from("students")
      .update(updates)
      .eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ ok: true });
}
