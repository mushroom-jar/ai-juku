import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    gradeLabel: string;
    goalStatus: "decided" | "rough" | "undecided";
    targetName?: string;
    worrySubject: string;
  };

  const { error } = await supabase
    .from("students")
    .update({
      starter_grade_label: body.gradeLabel,
      starter_goal_status: body.goalStatus,
      starter_target_name: body.targetName || null,
      starter_worry_subject: body.worrySubject,
      starter_questions_completed_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
