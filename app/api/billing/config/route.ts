import { NextResponse } from "next/server";
import { PLAN_DEFINITIONS } from "@/lib/plans";

export async function GET() {
  return NextResponse.json({
    yearlyAvailable:
      !!(PLAN_DEFINITIONS.basic.yearlyPriceId && PLAN_DEFINITIONS.premium.yearlyPriceId),
  });
}
