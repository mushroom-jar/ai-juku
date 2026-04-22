import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AI_MODEL, toAiUserMessage } from "@/lib/ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const INTERVIEW_SYSTEM = `
あなたは 永愛塾の初回面談を担当する先生です。
会話の目的は、生徒の今の状態を短い対話で整理し、学習ルート作成に必要な情報を集めることです。

聞きたいこと:
1. 学年
2. 志望校
3. 現在の学力感
4. 勉強している科目
5. 得意科目と苦手科目
6. 平日と休日の勉強時間
7. 勉強でいちばん詰まりやすいこと
8. 勉強スタイルの傾向

会話ルール:
- 一度に聞くのは多くても2つまで
- 自然な会話で進める
- 生徒を試すのではなく安心させる
- 必要な情報が十分に集まったら最後の返答の末尾に DONE を付ける
- DONE を付けるまでは、次に答えてほしいことが分かる返答にする
`;

const EXTRACT_PROMPT = `
以下の面談ログから、学習ルート作成に必要な情報を JSON で抽出してください。
余計な文章は書かず、JSON のみを返してください。

制約:
- grade は 1, 2, 3 の整数
- targetLevel は 1 から 5 の整数
- currentLevel は 1 から 5 の整数
- examYear は西暦4桁の整数
- subjects は "math" | "physics" | "chemistry" | "english" の配列
- studyStyle は "planner" | "steady" | "sprinter" | "mood"
- biggestBlocker は "start" | "continue" | "questions" | "schedule"
- weekdayMinutes, holidayMinutes は分単位の整数
- strongSubject, weakSubject は科目コードまたは null
- mode.aiTone は "cheerful" | "calm" | "strict" | "friendly"

targetLevel の目安:
1=基礎固め
2=共通テスト
3=MARCH・関関同立
4=地方国公立・難関私大
5=東大・京大・医学部級

出力形式:
{
  "name": "表示名",
  "grade": 2,
  "targetUniv": "志望校名",
  "targetLevel": 3,
  "examYear": 2027,
  "subjects": ["math", "english"],
  "currentLevel": 2,
  "studyStyle": "steady",
  "biggestBlocker": "schedule",
  "weekdayMinutes": 120,
  "holidayMinutes": 240,
  "strongSubject": "english",
  "weakSubject": "math",
  "mode": {
    "name": "コツコツ積み上げ型",
    "description": "毎日少しずつ積み上げると強いタイプ。迷いを減らして続けやすい設計が合います。",
    "aiTone": "calm"
  }
}

不足情報があっても、会話から自然に推定して埋めてください。
--- 面談ログ ---
`;

type ChatMessage = { role: "user" | "model"; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages, phase } = (await req.json()) as {
      messages: ChatMessage[];
      phase: "chat" | "extract";
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    if (phase === "chat") {
      const model = genAI.getGenerativeModel({
        model: AI_MODEL,
        systemInstruction: INTERVIEW_SYSTEM,
      });

      const rawHistory = messages.slice(0, -1).map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      }));
      const firstUserIndex = rawHistory.findIndex((message) => message.role === "user");
      const history = firstUserIndex >= 0 ? rawHistory.slice(firstUserIndex) : [];

      const chat = model.startChat({ history });
      const last = messages[messages.length - 1];
      const result = await chat.sendMessage(last.content);
      const raw = result.response.text().trim();
      const done = raw.endsWith("DONE") || raw === "DONE";
      const reply = raw.replace(/\s*DONE\s*$/, "").trim();

      return NextResponse.json({ reply, done });
    }

    if (phase === "extract") {
      const model = genAI.getGenerativeModel({ model: AI_MODEL });
      const conversation = messages
        .map((message) => `${message.role === "model" ? "AI" : "ユーザー"}: ${message.content}`)
        .join("\n");

      const result = await model.generateContent(EXTRACT_PROMPT + conversation);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return NextResponse.json({ error: "parse error" }, { status: 500 });
      }

      const data = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "invalid phase" }, { status: 400 });
  } catch (error) {
    const message = toAiUserMessage(error);
    console.error("[onboarding-interview] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

