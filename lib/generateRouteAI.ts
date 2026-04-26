import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL, toAiUserMessage } from "@/lib/ai";
import { SUBJECT_LABEL } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface RouteStrategy {
  overview: string;
  prioritySubjects: string[];
  firstWeekPolicy: string;
  warnings: string[];
}

const ROUTE_STRATEGY_PROMPT = `
あなたは大学受験の学習ルート設計の専門家です。
以下の生徒プロフィールをもとに、仮ルート戦略を JSON で出力してください。
余計な文章は書かず、JSON のみを返してください。

出力形式:
{
  "overview": "全体的な戦略の概要（100字以内）",
  "prioritySubjects": ["最優先科目のコード"],
  "firstWeekPolicy": "最初の1週間でやるべきこと（50字以内）",
  "warnings": ["注意点や落とし穴（1〜3つ）"]
}

科目コード: math, physics, chemistry, biology, english, japanese, world_history, japanese_history, geography, civics

--- 生徒プロフィール ---
`;

export async function generateRouteStrategy(
  serviceClient: SupabaseClient,
  studentId: string,
  student: {
    name: string;
    target_univ: string | null;
    target_faculty: string | null;
    exam_type: string | null;
    subjects: string[];
    current_level: number;
    target_level: number;
    subject_levels: Record<string, number> | null;
    last_mock_level: number | null;
    weakness_subjects: string[] | null;
    strength_subjects: string[] | null;
    available_study_time: { weekday_minutes?: number; holiday_minutes?: number } | null;
    biggest_blocker: string | null;
  }
): Promise<{ ok: boolean; strategy?: RouteStrategy; error?: string }> {
  try {
    const lines: string[] = [];
    lines.push(`名前: ${student.name}`);
    if (student.target_univ) lines.push(`志望校: ${student.target_univ}`);
    if (student.target_faculty) lines.push(`志望学部: ${student.target_faculty}`);
    if (student.exam_type) lines.push(`受験方式: ${student.exam_type}`);
    lines.push(`現在レベル: Lv.${student.current_level} / 目標レベル: Lv.${student.target_level}`);
    if (student.subjects.length) {
      lines.push(`受験科目: ${student.subjects.map((s) => SUBJECT_LABEL[s] ?? s).join(", ")}`);
    }
    if (student.subject_levels) {
      const entries = Object.entries(student.subject_levels)
        .map(([s, l]) => `${SUBJECT_LABEL[s] ?? s} Lv.${l}`)
        .join(", ");
      lines.push(`科目別レベル: ${entries}`);
    }
    if (student.last_mock_level) lines.push(`最新模試レベル感: Lv.${student.last_mock_level}`);
    if (student.strength_subjects?.length) {
      lines.push(`得意科目: ${student.strength_subjects.map((s) => SUBJECT_LABEL[s] ?? s).join(", ")}`);
    }
    if (student.weakness_subjects?.length) {
      lines.push(`不安科目: ${student.weakness_subjects.map((s) => SUBJECT_LABEL[s] ?? s).join(", ")}`);
    }
    if (student.available_study_time) {
      const wk = student.available_study_time.weekday_minutes ?? 0;
      const hol = student.available_study_time.holiday_minutes ?? 0;
      lines.push(`勉強時間目安: 平日 ${wk} 分 / 休日 ${hol} 分`);
    }
    if (student.biggest_blocker) lines.push(`詰まりやすさ: ${student.biggest_blocker}`);

    const model = genAI.getGenerativeModel({ model: AI_MODEL });
    const result = await model.generateContent(ROUTE_STRATEGY_PROMPT + lines.join("\n"));
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: "strategy parse error" };

    const strategy = JSON.parse(jsonMatch[0]) as RouteStrategy;
    await serviceClient.from("students").update({ route_strategy: strategy }).eq("id", studentId);

    return { ok: true, strategy };
  } catch (error) {
    return { ok: false, error: toAiUserMessage(error) };
  }
}
