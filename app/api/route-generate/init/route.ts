import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateRoute } from "@/lib/generateRoute";
import { generateRouteStrategy } from "@/lib/generateRouteAI";

// Stripe決済完了後のリダイレクト先
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const { data: student } = await supabase
    .from("students")
    .select("id, name, current_level, target_level, target_univ, target_faculty, exam_type, subjects, subject_levels, last_mock_level, weakness_subjects, strength_subjects, available_study_time, biggest_blocker")
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.redirect(`${appUrl}/onboarding`);

  const serviceClient = await createServiceClient();

  const [routeResult, strategyResult] = await Promise.all([
    generateRoute(serviceClient, student.id, student),
    generateRouteStrategy(serviceClient, student.id, {
      name: student.name as string,
      target_univ: student.target_univ as string | null,
      target_faculty: student.target_faculty as string | null,
      exam_type: student.exam_type as string | null,
      subjects: student.subjects as string[],
      current_level: student.current_level as number,
      target_level: student.target_level as number,
      subject_levels: student.subject_levels as Record<string, number> | null,
      last_mock_level: student.last_mock_level as number | null,
      weakness_subjects: student.weakness_subjects as string[] | null,
      strength_subjects: student.strength_subjects as string[] | null,
      available_study_time: student.available_study_time as { weekday_minutes?: number; holiday_minutes?: number } | null,
      biggest_blocker: student.biggest_blocker as string | null,
    }),
  ]);

  if (!routeResult.ok) {
    console.error("[route-generate/init] route generation failed:", routeResult.error);
  }
  console.info(
    `[route-generate/init] route=${routeResult.ok ? "ok" : "failed"} books=${routeResult.count ?? 0} strategy=${strategyResult.ok ? "ok" : "failed"}`
  );

  return NextResponse.redirect(`${appUrl}/route`);
}
