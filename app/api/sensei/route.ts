import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPlanDisplayName } from "@/lib/plans";
import { AI_MODEL, toAiUserMessage } from "@/lib/ai";
import { SUBJECT_LABEL } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const BASE_PROMPT = `
あなたは永愛塾の専属コーチ「My先生」です。
生徒の学習データ、面談プロフィール、最近の記録をもとに、毎日の自習を支える役割です。

ルール:
- 返答はやさしく、具体的に、短すぎず長すぎず
- 抽象論ではなく、次に何をするとよいかまで示す
- 生徒が不安そうな時は安心させる
- ただし甘やかしすぎず、前に進める一歩を必ず出す
- 一度に提案する行動は多くても3つまで
- 問題の質問には、考え方 -> 解き方 -> 次に見直す点 の順で答える
- 行動導線を1つだけ付けたい時は、文末に次の形式で1つだけ付ける
  <!--ACTION:{"type":"record","label":"記録する"}-->
- action type は record | schedule | practice | shelf | question のみ
- ホーム画面の一言メッセージを更新したい場合のみ、文末に次の形式で付ける
  <!--SET_HOME_MESSAGE:{"message":"更新後のメッセージ（40字以内）"}-->
  これを使うのは生徒が「今日のメッセージを変えて」と明示的に頼んだ時だけ

避けること:
- 高圧的な口調
- 根拠のない励ましだけで終わること
- いきなり大量のタスクを出すこと
`;

const STYLE_LABEL: Record<string, string> = {
  planner: "計画型",
  steady: "コツコツ型",
  sprinter: "追い込み型",
  mood: "波がある型",
};

const BLOCKER_LABEL: Record<string, string> = {
  start: "始めるまでが重い",
  continue: "続けている途中で止まりやすい",
  questions: "分からない問題で止まりやすい",
  schedule: "何をやるか迷いやすい",
};

const PERSONALITY_ADDITION: Record<string, string> = {
  strict: `

口調の追加指示 (厳しめ):
- 甘い言葉より「なぜそれでは足りないか」を明示する
- 根拠なき慰めは使わない。改善点を遠慮なく出す
- 褒める場合は具体的な根拠がある時だけ
- 「本当にこれで受かると思う?」と自問させる言葉を使う`,
  friendly: `

口調の追加指示 (友達感覚):
- 「〜だよ」「〜だね」「〜じゃない?」のようなカジュアルな語尾を使う
- 一緒に考えるスタンスで、断定より提案を好む
- 適度に軽い言葉で親近感を出しつつ、核心は外さない`,
  balanced: "",
};

type ApiMessage = { role: "user" | "model"; content: string };

async function buildStudentContext(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, name, subjects, exam_date, target_univ, current_level, plan, study_style, available_study_time, biggest_blocker, strength_subjects, weakness_subjects, onboarding_summary"
    )
    .eq("user_id", userId)
    .single();

  if (!student) return "";

  const lines: string[] = ["--- 生徒プロフィール ---"];
  lines.push(`名前: ${student.name}`);
  lines.push(`プラン: ${getPlanDisplayName((student.plan ?? "free") as "free" | "basic" | "premium")}`);

  if (student.target_univ) lines.push(`志望校: ${student.target_univ}`);
  if (student.exam_date) {
    const days = Math.ceil((new Date(student.exam_date).getTime() - Date.now()) / 86400000);
    lines.push(`受験まで: ${days > 0 ? `あと${days}日` : "受験日を過ぎています"}`);
  }
  if (student.subjects?.length) {
    lines.push(`使用科目: ${(student.subjects as string[]).map((s) => SUBJECT_LABEL[s] ?? s).join(" / ")}`);
  }
  if (typeof student.current_level === "number") {
    lines.push(`現在レベル: Lv.${student.current_level}`);
  }
  if (student.study_style) {
    lines.push(`勉強スタイル: ${STYLE_LABEL[student.study_style] ?? student.study_style}`);
  }
  if (student.biggest_blocker) {
    lines.push(`詰まりやすい点: ${BLOCKER_LABEL[student.biggest_blocker] ?? student.biggest_blocker}`);
  }

  const availableStudyTime = student.available_study_time as { weekday_minutes?: number; holiday_minutes?: number } | null;
  if (availableStudyTime?.weekday_minutes || availableStudyTime?.holiday_minutes) {
    lines.push(`勉強時間の目安: 平日 ${availableStudyTime?.weekday_minutes ?? 0} 分 / 休日 ${availableStudyTime?.holiday_minutes ?? 0} 分`);
  }

  if (student.strength_subjects?.length) {
    lines.push(`得意寄り: ${(student.strength_subjects as string[]).map((s) => SUBJECT_LABEL[s] ?? s).join(" / ")}`);
  }
  if (student.weakness_subjects?.length) {
    lines.push(`不安寄り: ${(student.weakness_subjects as string[]).map((s) => SUBJECT_LABEL[s] ?? s).join(" / ")}`);
  }
  if (student.onboarding_summary) {
    lines.push("初回面談の要約:");
    lines.push(student.onboarding_summary);
  }

  const { data: activeRoutes } = await supabase
    .from("student_routes")
    .select("step_order, books(title, subject)")
    .eq("student_id", student.id)
    .eq("status", "in_progress")
    .order("step_order")
    .limit(3);

  if (activeRoutes?.length) {
    const activeBooks = activeRoutes
      .map((route) => {
        const book = route.books as unknown as { title: string; subject: string } | null;
        return book ? `${book.title} (${SUBJECT_LABEL[book.subject] ?? book.subject})` : null;
      })
      .filter(Boolean);
    if (activeBooks.length) lines.push(`進行中ルート: ${activeBooks.join(" / ")}`);
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: recentResults } = await supabase
    .from("problem_results")
    .select("book_id, result, recorded_at")
    .eq("student_id", student.id)
    .gte("recorded_at", twoWeeksAgo.toISOString());

  const results = recentResults ?? [];
  if (results.length > 0) {
    const perfect = results.filter((r) => r.result === "perfect").length;
    const wrong = results.filter((r) => r.result === "wrong").length;
    const unsure = results.filter((r) => r.result === "unsure").length;
    const masteryRate = Math.round((perfect / results.length) * 100);
    lines.push(`直近14日の記録: ${results.length}件 / 理解率 ${masteryRate}% / 理解 ${perfect} / 不安 ${unsure} / 苦戦 ${wrong}`);
  } else {
    lines.push("直近14日の記録はまだ少なめです。");
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json() as {
      messages?: ApiMessage[];
      sessionId?: string;
      message?: string;
    };

    let historyForGemini: { role: string; parts: { text: string }[] }[] = [];
    let currentMessage = "";
    let sessionId: string | null = null;

    if (body.sessionId && body.message) {
      // Session-based mode: load history from DB
      sessionId = body.sessionId;
      currentMessage = body.message;

      const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
      if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

      const { data: session } = await supabase
        .from("chat_sessions").select("id")
        .eq("id", sessionId).eq("student_id", student.id).single();
      if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

      // Load last 40 messages for context
      const { data: dbMsgs } = await supabase
        .from("chat_messages").select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(40);

      const rawHistory = (dbMsgs ?? []).map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
      const firstUserIndex = rawHistory.findIndex((m) => m.role === "user");
      historyForGemini = firstUserIndex >= 0 ? rawHistory.slice(firstUserIndex) : [];

    } else if (body.messages?.length) {
      // Legacy stateless mode
      currentMessage = body.messages[body.messages.length - 1].content;
      const rawHistory = body.messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
      const firstUserIndex = rawHistory.findIndex((m) => m.role === "user");
      historyForGemini = firstUserIndex >= 0 ? rawHistory.slice(firstUserIndex) : [];
    } else {
      return NextResponse.json({ error: "messages or sessionId+message required" }, { status: 400 });
    }

    let studentContext = "";
    let personalityKey = "balanced";
    try {
      [studentContext] = await Promise.all([
        buildStudentContext(user.id),
        supabase
          .from("students")
          .select("sensei_personality")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            personalityKey = (data?.sensei_personality as string | null) ?? "balanced";
          }),
      ]);
    } catch (error) {
      console.error("[sensei] buildStudentContext error:", error);
    }

    const personalityAddition = PERSONALITY_ADDITION[personalityKey] ?? "";
    const fullPrompt = `${BASE_PROMPT}${personalityAddition}`;
    const systemPrompt = studentContext ? `${fullPrompt}\n\n${studentContext}` : fullPrompt;
    const model = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: systemPrompt });

    const chat = model.startChat({ history: historyForGemini });
    const result = await chat.sendMessage(currentMessage);
    const text = result.response.text();

    const actionMatch = text.match(/<!--ACTION:(.+?)-->/);
    let action: { type: string; label: string } | null = null;
    let reply = text;
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        reply = reply.replace(/<!--ACTION:.+?-->/, "").trim();
      } catch {
        action = null;
      }
    }

    // Handle home_message update request from AI
    const homeMessageMatch = reply.match(/<!--SET_HOME_MESSAGE:(.+?)-->/);
    if (homeMessageMatch) {
      try {
        const { message } = JSON.parse(homeMessageMatch[1]) as { message?: string };
        if (message) {
          await supabase.from("students").update({ home_message: message }).eq("user_id", user.id);
        }
      } catch { /* ignore malformed marker */ }
      reply = reply.replace(/<!--SET_HOME_MESSAGE:.+?-->/, "").trim();
    }

    // Persist messages and update session timestamp
    if (sessionId) {
      await Promise.all([
        supabase.from("chat_messages").insert([
          { session_id: sessionId, role: "user", content: currentMessage, kind: "chat" },
          { session_id: sessionId, role: "model", content: reply, kind: "chat" },
        ]),
        supabase.from("chat_sessions")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", sessionId),
      ]);
    }

    return NextResponse.json({ reply, action });
  } catch (error) {
    const message = toAiUserMessage(error);
    console.error("[sensei] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
