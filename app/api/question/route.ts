import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askWithImage, askWithText } from "@/lib/ai";
import { calcLevel } from "@/lib/levels";
import { getPlanDisplayName, getQuestionLimit, type StudentPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, plan, xp")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }

  const plan = (student.plan ?? "free") as StudentPlan;
  const level = calcLevel(student.xp ?? 0).level;
  const monthlyLimit = getQuestionLimit(plan, level);

  if (monthlyLimit != null) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("question_logs")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student.id)
      .gte("asked_at", monthStart.toISOString());

    if ((count ?? 0) >= monthlyLimit) {
      return NextResponse.json(
        {
          error: "monthly_limit",
          message: `${getPlanDisplayName(plan)}では今月の質問上限に達しています。少し時間を置くか、より多く質問できるプランを検討してください。`,
        },
        { status: 429 }
      );
    }
  }

  const formData = await req.formData();
  const question = (formData.get("question") as string | null) ?? "";
  const imageFile = formData.get("image") as File | null;

  let aiResponse = "";

  if (imageFile && imageFile.size > 0) {
    const buffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    aiResponse = await askWithImage(base64, imageFile.type, question);
  } else if (question.trim()) {
    aiResponse = await askWithText(question);
  } else {
    return NextResponse.json({ error: "question or image required" }, { status: 400 });
  }

  await supabase.from("question_logs").insert({
    student_id: student.id,
    question_text: question,
    ai_response: aiResponse,
    via: "app",
  });

  return NextResponse.json({ answer: aiResponse });
}
