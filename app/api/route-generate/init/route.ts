import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateRoute } from "@/lib/generateRoute";

// Stripe決済完了後のリダイレクト先
// ルートを自動生成してから /route へ転送する
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const { data: student } = await supabase
    .from("students")
    .select("id, current_level, target_level, subjects")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.redirect(`${appUrl}/onboarding`);

  const serviceClient = await createServiceClient();
  await generateRoute(serviceClient, student.id, student);

  return NextResponse.redirect(`${appUrl}/route`);
}
