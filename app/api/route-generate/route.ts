import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateRoute } from "@/lib/generateRoute";
import { generateRouteStrategy } from "@/lib/generateRouteAI";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { studentId } = await req.json();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, current_level, target_level, target_univ, target_faculty, exam_type, subjects, subject_levels, last_mock_level, weakness_subjects, strength_subjects, available_study_time, biggest_blocker")
    .eq("id", studentId)
    .eq("user_id", user.id)
    .single();

  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const serviceClient = await createServiceClient();

  const [routeResult, strategyResult] = await Promise.all([
    generateRoute(serviceClient, studentId, student),
    generateRouteStrategy(serviceClient, studentId, {
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

  if (!routeResult.ok) return NextResponse.json({ error: routeResult.error }, { status: 400 });

  if (!strategyResult.ok) {
    console.warn("[route-generate] strategy generation failed:", strategyResult.error);
  }

  return NextResponse.json({ ok: true, count: routeResult.count, strategyOk: strategyResult.ok });
}
