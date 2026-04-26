import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import {
  PLAN_DEFINITIONS,
  getLumpSumAmount,
  getCheckoutPrice,
  type StudentPlan,
  type LumpSumMonths,
} from "@/lib/plans";

type Body = {
  planKey: "basic" | "premium";
  months: LumpSumMonths; // 1=月額サブスク, 3/12=まとめ払い
  referralCode?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createServiceClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, user_id, name, stripe_customer_id, plan, ai_support_trial_used, ai_juku_trial_used")
    .eq("payment_token", token)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Stripe顧客IDを確保する（なければ作成して保存）
  let customerId = (student.stripe_customer_id as string | null);
  if (!customerId) {
    let email: string | undefined;
    if (student.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(student.user_id as string);
      email = authUser?.user?.email ?? undefined;
    }
    const customer = await stripe.customers.create({
      ...(email ? { email } : {}),
      name: student.name as string,
      metadata: { student_id: student.id as string },
    });
    customerId = customer.id;
    await supabase.from("students").update({ stripe_customer_id: customerId }).eq("id", student.id);
  }

  const body = (await req.json()) as Body;
  const { planKey, months, referralCode } = body;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const isSubscription = months === 1;

  // 招待コードの検証（あれば）
  let referralCodeId: string | null = null;
  let referrerStudentId: string | null = null;
  if (referralCode) {
    const { data: rc } = await supabase
      .from("referral_codes")
      .select("id, student_id")
      .eq("code", referralCode.toUpperCase())
      .maybeSingle();
    if (rc && rc.student_id !== student.id) {
      referralCodeId = rc.id;
      referrerStudentId = rc.student_id;
    }
  }

  const metadata: Record<string, string> = {
    student_id: student.id as string,
    plan_key: planKey,
    months: String(months),
    payment_type: isSubscription ? "subscription" : "lump_sum",
    ...(referralCodeId ? { referral_code_id: referralCodeId, referrer_student_id: referrerStudentId! } : {}),
  };

  let sessionUrl: string | null;

  if (isSubscription) {
    // 月額サブスク
    const price = getCheckoutPrice(planKey, "monthly");
    if (!price.priceId) {
      return NextResponse.json({ error: "price_not_configured" }, { status: 400 });
    }

    const currentPlan = (student.plan ?? "free") as StudentPlan;
    let trialPeriodDays: number | undefined;
    if (planKey === "basic" && currentPlan === "free" && !student.ai_support_trial_used) {
      trialPeriodDays = 7;
    }
    if (planKey === "premium" && !student.ai_juku_trial_used) {
      trialPeriodDays = 7;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price.priceId, quantity: 1 }],
      success_url: `${appUrl}/pay/${token}?success=1`,
      cancel_url: `${appUrl}/pay/${token}`,
      metadata,
      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata,
      },
    });
    sessionUrl = session.url;
  } else {
    // まとめ払い（一括）
    const amount = getLumpSumAmount(planKey, months);
    const planName = PLAN_DEFINITIONS[planKey].name;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "jpy",
          product_data: {
            name: `永愛塾 ${planName} ${months}ヶ月分`,
            description: `${student.name}さんの${months}ヶ月分プラン`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/pay/${token}?success=1`,
      cancel_url: `${appUrl}/pay/${token}`,
      metadata,
    });
    sessionUrl = session.url;
  }

  return NextResponse.json({ url: sessionUrl });
}
