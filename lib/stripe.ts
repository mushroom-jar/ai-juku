import Stripe from "stripe";
import { PLAN_DEFINITIONS } from "@/lib/plans";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe: Stripe = new Proxy({} as any, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PLANS = {
  basic: {
    label: PLAN_DEFINITIONS.basic.name,
    monthlyPrice: PLAN_DEFINITIONS.basic.monthlyPrice,
    yearlyPrice: PLAN_DEFINITIONS.basic.yearlyPrice,
    monthlyPriceId: PLAN_DEFINITIONS.basic.monthlyPriceId,
    yearlyPriceId: PLAN_DEFINITIONS.basic.yearlyPriceId,
  },
  premium: {
    label: PLAN_DEFINITIONS.premium.name,
    monthlyPrice: PLAN_DEFINITIONS.premium.monthlyPrice,
    yearlyPrice: PLAN_DEFINITIONS.premium.yearlyPrice,
    monthlyPriceId: PLAN_DEFINITIONS.premium.monthlyPriceId,
    yearlyPriceId: PLAN_DEFINITIONS.premium.yearlyPriceId,
  },
} as const;
