import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const SYSTEM_PROMPT = `
あなたは大学受験向けの学習支援AIです。数学・物理・化学・英語の質問に丁寧に答えます。
ルール:
- 解き方をごとに分けて説明する
- なぜその方針になるかを短く添える
- 難しい用語はできるだけやさしく言い換える
- 最後に、次に見直すとよいポイントを1つだけ添える
`;

export function isGeminiQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("quota") || message.includes("Too Many Requests");
}

export function toAiUserMessage(error: unknown) {
  if (isGeminiQuotaError(error)) {
    return "いま AI の利用上限に達しているため、少し時間を置いてからもう一度試してください。Gemini の請求設定や利用枠を見直すと安定しやすくなります。";
  }

  return error instanceof Error ? error.message : "AIでエラーが発生しました。";
}

export async function askWithText(question: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: AI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(question);
    return result.response.text();
  } catch (error) {
    throw new Error(toAiUserMessage(error));
  }
}

export async function askWithImage(imageBase64: string, mimeType: string, comment: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: AI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      comment || "この問題の考え方と解き方を教えてください。",
    ]);
    return result.response.text();
  } catch (error) {
    throw new Error(toAiUserMessage(error));
  }
}

export async function generateWeeklyFeedback(
  studentName: string,
  completedCount: number,
  missedDays: string[],
  masteredProblems: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: AI_MODEL,
      systemInstruction:
        "あなたは受験生向けの学習コーチです。週次の学習記録をもとに、やさしく具体的なフィードバックを200文字以内で返してください。",
    });
    const result = await model.generateContent(
      `名前: ${studentName}\n完了タスク数: ${completedCount}\n未実施の日: ${missedDays.join("・") || "なし"}\n今週理解できた問題数: ${masteredProblems}`
    );
    return result.response.text();
  } catch (error) {
    throw new Error(toAiUserMessage(error));
  }
}
