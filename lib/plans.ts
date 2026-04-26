export type StudentPlan = "free" | "basic" | "premium";
export type BillingInterval = "monthly" | "yearly";

export const QUESTION_LIMITS: Record<StudentPlan, number | null> = {
  free: 0,
  basic: 30,
  premium: null,
};

export function getLevelQuestionBonus(level: number) {
  if (level >= 9) return 20;
  if (level >= 7) return 15;
  if (level >= 5) return 10;
  if (level >= 3) return 5;
  return 0;
}

export function getQuestionLimit(plan: StudentPlan, level = 1) {
  const baseLimit = QUESTION_LIMITS[plan];
  if (baseLimit == null) return null;
  if (plan !== "basic") return baseLimit;
  return baseLimit + getLevelQuestionBonus(level);
}

export function canUseAiJukuLevelPerk(level: number) {
  return level >= 5;
}

export const PLAN_DEFINITIONS = {
  free: {
    code: "free" as const,
    name: "無料",
    shortName: "無料",
  },
  basic: {
    code: "basic" as const,
    name: "AIパートナー",
    shortName: "AIパートナー",
    monthlyPrice: 3480,
    yearlyPrice: 34800,
    monthlyPriceId: process.env.STRIPE_AI_SUPPORT_MONTHLY_PRICE_ID ?? process.env.STRIPE_BASIC_PRICE_ID ?? "",
    yearlyPriceId: process.env.STRIPE_AI_SUPPORT_YEARLY_PRICE_ID ?? "",
  },
  premium: {
    code: "premium" as const,
    name: "永愛塾",
    shortName: "永愛塾",
    monthlyPrice: 7980,
    yearlyPrice: 79800,
    monthlyPriceId: process.env.STRIPE_AI_JUKU_MONTHLY_PRICE_ID ?? process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
    yearlyPriceId: process.env.STRIPE_AI_JUKU_YEARLY_PRICE_ID ?? "",
  },
} as const;

export function getPlanDisplayName(plan: StudentPlan) {
  return PLAN_DEFINITIONS[plan].name;
}

export function isUnlimitedQuestionPlan(plan: StudentPlan) {
  return QUESTION_LIMITS[plan] == null;
}

export function getCheckoutPrice(plan: Exclude<StudentPlan, "free">, interval: BillingInterval) {
  const definition = PLAN_DEFINITIONS[plan];
  const priceId = interval === "yearly" ? definition.yearlyPriceId : definition.monthlyPriceId;
  const amount = interval === "yearly" ? definition.yearlyPrice : definition.monthlyPrice;

  return {
    plan,
    interval,
    priceId,
    amount,
    name: definition.name,
  };
}

export function getPlanFromPriceId(priceId: string): StudentPlan {
  if (!priceId) return "free";
  if (priceId === PLAN_DEFINITIONS.premium.monthlyPriceId || priceId === PLAN_DEFINITIONS.premium.yearlyPriceId) {
    return "premium";
  }
  if (priceId === PLAN_DEFINITIONS.basic.monthlyPriceId || priceId === PLAN_DEFINITIONS.basic.yearlyPriceId) {
    return "basic";
  }
  return "free";
}

export function getBillingIntervalFromPriceId(priceId: string): BillingInterval {
  if (priceId === PLAN_DEFINITIONS.basic.yearlyPriceId || priceId === PLAN_DEFINITIONS.premium.yearlyPriceId) {
    return "yearly";
  }
  return "monthly";
}

// まとめ払い（一括）の金額
export const LUMP_SUM_OPTIONS = [
  { months: 1,  label: "1ヶ月",  discountPct: 0 },
  { months: 3,  label: "3ヶ月",  discountPct: 5 },
  { months: 12, label: "12ヶ月", discountPct: 17 },
] as const;

export type LumpSumMonths = 1 | 3 | 12;

export function getLumpSumAmount(plan: Exclude<StudentPlan, "free">, months: LumpSumMonths): number {
  const monthly = PLAN_DEFINITIONS[plan].monthlyPrice;
  const option = LUMP_SUM_OPTIONS.find((o) => o.months === months)!;
  return Math.floor(monthly * months * (1 - option.discountPct / 100));
}
