"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";

type ChatMessage = { role: "user" | "model"; content: string };
type Status = "chatting" | "extracting" | "confirming" | "saving";

type StudyStyle = "planner" | "steady" | "sprinter" | "mood";
type BiggestBlocker = "start" | "continue" | "questions" | "schedule";
type AiTone = "cheerful" | "calm" | "strict" | "friendly";

interface ExtractedData {
  name: string;
  grade: 1 | 2 | 3;
  targetUniv: string;
  targetLevel: number;
  examYear: number;
  subjects: Subject[];
  currentLevel: number;
  studyStyle: StudyStyle;
  biggestBlocker: BiggestBlocker;
  weekdayMinutes: number;
  holidayMinutes: number;
  strongSubject: Subject | null;
  weakSubject: Subject | null;
  mode: {
    name: string;
    description: string;
    aiTone: AiTone;
  };
}

const INITIAL_MESSAGE: ChatMessage = {
  role: "model",
  content:
    "はじめまして。永愛塾の最初の作戦会議へようこそ。短いやり取りの中で、あなたに合う勉強の進め方を一緒に整理します。まずは学年、志望校、今いちばん困っていることから教えてください。",
};

const STYLE_LABEL: Record<StudyStyle, string> = {
  planner: "計画型",
  steady: "コツコツ型",
  sprinter: "追い込み型",
  mood: "波がある型",
};

const BLOCKER_LABEL: Record<BiggestBlocker, string> = {
  start: "始めるまでが重い",
  continue: "続けている途中で止まりやすい",
  questions: "分からない問題で止まりやすい",
  schedule: "何をやるか迷いやすい",
};

const SUBJECT_LABEL: Record<Subject, string> = {
  math: "数学",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  english: "英語",
  japanese: "国語",
  world_history: "世界史",
  japanese_history: "日本史",
  geography: "地理",
  civics: "公民",
  information: "情報",
  other: "その他",
};

const LEVEL_LABELS: Record<number, string> = {
  1: "基礎固め",
  2: "共通テスト",
  3: "MARCH・関関同立",
  4: "地方国公立・難関私大",
  5: "東大・京大・医学部級",
};

const AI_TONE_LABELS: Record<AiTone, string> = {
  cheerful: "明るく背中を押してくれる",
  calm: "落ち着いて整理してくれる",
  strict: "少し厳しめに本気で導く",
  friendly: "やわらかく話しやすい",
};

export default function OnboardingPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("chatting");
  const [isThinking, setIsThinking] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, isThinking]);

  useEffect(() => {
    if (status === "chatting" && !isThinking) {
      inputRef.current?.focus();
    }
  }, [status, isThinking]);

  const checklist = useMemo(
    () => [
      "登録後すぐに始める最初の AI 面談です",
      "会話内容は My先生 と学習ルートの土台になります",
      "最後にルートを作成して、プラン選択へ進みます",
    ],
    []
  );

  async function sendMessage() {
    const text = input.trim();
    if (!text || isThinking || status !== "chatting") return;

    const nextMessages = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, phase: "chat" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "AI面談の返答でエラーが発生しました。もう一度試してください。");
      }

      if (data.reply) {
        setMessages([...nextMessages, { role: "model", content: data.reply }]);
      }

      if (data.done) {
        setStatus("extracting");
        await extractInterview(nextMessages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI面談でエラーが発生しました。");
    } finally {
      setIsThinking(false);
    }
  }

  async function extractInterview(chatMessages: ChatMessage[]) {
    try {
      const res = await fetch("/api/onboarding-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, phase: "extract" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "面談内容の整理に失敗しました。");
      }

      setExtractedData(data.data);
      setStatus("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "面談内容の整理に失敗しました。");
      setStatus("chatting");
    }
  }

  async function handleSave() {
    if (!extractedData) return;

    setStatus("saving");
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: existingRows } = await supabase.from("students").select("id").eq("user_id", user.id).limit(1);
    const existing = existingRows?.[0] ?? null;

    const summary = [
      `${extractedData.name}さんは「${extractedData.mode.name}」タイプです。`,
      extractedData.mode.description,
      `志望校: ${extractedData.targetUniv}`,
      `現在レベル: Lv.${extractedData.currentLevel}（${LEVEL_LABELS[extractedData.currentLevel] ?? "未設定"}）`,
      `勉強スタイル: ${STYLE_LABEL[extractedData.studyStyle]}`,
      `詰まりやすい点: ${BLOCKER_LABEL[extractedData.biggestBlocker]}`,
      `勉強時間: 平日 ${extractedData.weekdayMinutes} 分 / 休日 ${extractedData.holidayMinutes} 分`,
    ].join("\n");

    const conversationText = messages
      .map((message) => `${message.role === "model" ? "AI" : "ユーザー"}: ${message.content}`)
      .join("\n");

    const payload = {
      user_id: user.id,
      name: extractedData.name,
      grade: extractedData.grade,
      target_univ: extractedData.targetUniv,
      target_level: extractedData.targetLevel,
      exam_date: `${extractedData.examYear}-01-15`,
      subjects: extractedData.subjects,
      current_level: extractedData.currentLevel,
      onboarding_done: true,
      study_style: extractedData.studyStyle,
      available_study_time: {
        weekday_minutes: extractedData.weekdayMinutes,
        holiday_minutes: extractedData.holidayMinutes,
      },
      biggest_blocker: extractedData.biggestBlocker,
      strength_subjects: extractedData.strongSubject ? [extractedData.strongSubject] : [],
      weakness_subjects: extractedData.weakSubject ? [extractedData.weakSubject] : [],
      onboarding_summary: summary,
      onboarding_answers: {
        study_style: extractedData.studyStyle,
        biggest_blocker: extractedData.biggestBlocker,
        weekday_minutes: extractedData.weekdayMinutes,
        holiday_minutes: extractedData.holidayMinutes,
        strong_subject: extractedData.strongSubject ?? null,
        weak_subject: extractedData.weakSubject ?? null,
        mode: extractedData.mode,
      },
      ai_interview_completed_at: new Date().toISOString(),
      interview_transcript: conversationText,
    };

    let studentId: string;

    if (existing) {
      const { error: updateError } = await supabase.from("students").update(payload).eq("id", existing.id);
      if (updateError) {
        setError(updateError.message);
        setStatus("confirming");
        return;
      }
      studentId = existing.id;
    } else {
      const { data: created, error: insertError } = await supabase.from("students").insert(payload).select("id").single();
      if (insertError || !created) {
        setError(insertError?.message ?? "面談データの保存に失敗しました。");
        setStatus("confirming");
        return;
      }
      studentId = created.id;
    }

    await fetch("/api/route-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    }).catch(() => undefined);

    window.location.href = "/billing?entry=onboarding&next=/route";
  }

  return (
    <div style={pageStyle}>
      <div style={layoutStyle}>
        <section style={heroStyle}>
          <div style={heroIconWrapStyle}>
            <Wand2 size={22} />
          </div>
          <div style={eyebrowStyle}>AI Interview</div>
          <h1 style={heroHeadingStyle}>
            最初の作戦会議から
            <br />
            ルート作成へ進もう
          </h1>
          <p style={heroBodyStyle}>
            ここでは、あなたの目標と今の状態を AI と一緒に整理します。面談の結果は学習ルート、My先生、日々の提案にそのままつながります。
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
            {checklist.map((line) => (
              <div key={line} style={heroListRowStyle}>
                <Sparkles size={15} />
                <span style={{ fontSize: 13, lineHeight: 1.6 }}>{line}</span>
              </div>
            ))}
          </div>

          {status === "extracting" ? (
            <div style={heroStatusStyle}>
              <div style={heroStatusDotStyle} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>面談をもとに学習タイプを整理しています...</span>
            </div>
          ) : null}
        </section>

        <section style={chatCardStyle}>
          <div style={chatHeaderStyle}>
            <div style={chatHeaderIconStyle}>
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>永愛先生</div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                {status === "chatting" && "面談中"}
                {status === "extracting" && "整理中..."}
                {status === "confirming" && "内容確認"}
                {status === "saving" && "保存中..."}
              </div>
            </div>
          </div>

          <div style={messageAreaStyle}>
            {messages.map((message, index) => (
              <div key={index} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={messageBubbleStyle(message.role === "user")}>{message.content}</div>
              </div>
            ))}

            {isThinking ? (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={thinkingBubbleStyle}>
                  {[0, 1, 2].map((index) => (
                    <div key={index} style={{ ...thinkingDotStyle, animation: `bounce 1s ${index * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            ) : null}

            {status === "confirming" && extractedData ? <ModeRevealCard data={extractedData} onConfirm={handleSave} error={error} /> : null}

            {status === "saving" ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#64748B", fontSize: 14, fontWeight: 700 }}>
                学習ルートを準備しています。もう少しだけお待ちください。
              </div>
            ) : null}

            {error && status === "chatting" ? (
              <div style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{error}</div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {status === "chatting" ? (
            <div style={inputWrapStyle}>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="ここに回答を入力してください..."
                disabled={isThinking}
                style={inputStyle}
              />
              <button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || isThinking} style={sendButtonStyle(!input.trim() || isThinking)}>
                <Send size={18} />
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ModeRevealCard({ data, onConfirm, error }: { data: ExtractedData; onConfirm: () => void; error: string }) {
  return (
    <div style={{ animation: "fadeUp 0.5s ease both", display: "grid", gap: 14 }}>
      <div style={modeHeroStyle}>
        <div style={modeEyebrowStyle}>あなたの学習タイプ</div>
        <div style={modeHeadingStyle}>{data.mode.name}</div>
        <p style={modeBodyStyle}>{data.mode.description}</p>
        <div style={modeToneStyle}>
          <Bot size={14} />
          永愛先生の話し方: {AI_TONE_LABELS[data.mode.aiTone] ?? data.mode.aiTone}
        </div>
      </div>

      <div style={summaryCardStyle}>
        <div style={summaryEyebrowStyle}>面談で整理した内容</div>
        {[
          { label: "名前", value: `${data.name} / 高${data.grade}` },
          { label: "志望校", value: data.targetUniv },
          { label: "科目", value: data.subjects.map((subject) => SUBJECT_LABEL[subject] ?? subject).join("・") },
          { label: "現在レベル", value: `Lv.${data.currentLevel}（${LEVEL_LABELS[data.currentLevel] ?? "未設定"}）` },
          { label: "勉強スタイル", value: STYLE_LABEL[data.studyStyle] },
          { label: "詰まりやすさ", value: BLOCKER_LABEL[data.biggestBlocker] },
          { label: "勉強時間", value: `平日 ${data.weekdayMinutes} 分 / 休日 ${data.holidayMinutes} 分` },
        ].map(({ label, value }) => (
          <div key={label} style={summaryRowStyle}>
            <span style={summaryLabelStyle}>{label}</span>
            <span style={summaryValueStyle}>{value}</span>
          </div>
        ))}
      </div>

      {error ? <div style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700 }}>{error}</div> : null}

      <button type="button" onClick={onConfirm} style={confirmButtonStyle}>
        この内容でルートを作成してプラン選択へ進む
      </button>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background:
    "radial-gradient(circle at top left, rgba(191,219,254,0.75) 0%, rgba(243,245,249,0.86) 28%, #F3F5F9 62%), linear-gradient(180deg,#F8FAFF 0%,#F3F5F9 100%)",
  padding: "28px 16px 40px",
};
const layoutStyle: CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 18,
  alignItems: "stretch",
};
const heroStyle: CSSProperties = {
  borderRadius: 28,
  padding: 28,
  background: "linear-gradient(145deg,#0F172A 0%,#1E3A8A 68%,#3157B7 100%)",
  color: "#FFFFFF",
  boxShadow: "0 24px 50px rgba(15,23,42,0.22)",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const heroIconWrapStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  background: "rgba(255,255,255,0.14)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const eyebrowStyle: CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.76 };
const heroHeadingStyle: CSSProperties = { margin: 0, fontSize: 34, lineHeight: 1.15, letterSpacing: "-0.04em" };
const heroBodyStyle: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.8, opacity: 0.84 };
const heroListRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
};
const heroStatusStyle: CSSProperties = {
  marginTop: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  width: "fit-content",
  padding: "12px 14px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.12)",
};
const heroStatusDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#FDE68A",
  animation: "pulse 1.4s ease-in-out infinite",
};
const chatCardStyle: CSSProperties = {
  borderRadius: 28,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.12)",
  boxShadow: "0 24px 46px rgba(15,23,42,0.08)",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  minHeight: 720,
};
const chatHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "18px 20px",
  borderBottom: "1px solid rgba(148,163,184,0.12)",
  background: "rgba(248,250,252,0.86)",
};
const chatHeaderIconStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(49,87,183,0.1)",
  color: "#3157B7",
};
const messageAreaStyle: CSSProperties = {
  padding: 20,
  display: "grid",
  gap: 12,
  alignContent: "start",
  overflowY: "auto",
  background: "linear-gradient(180deg,#FBFCFF 0%,#FFFFFF 100%)",
};
const messageBubbleStyle = (isUser: boolean): CSSProperties => ({
  maxWidth: "88%",
  padding: "14px 16px",
  borderRadius: isUser ? "20px 20px 8px 20px" : "20px 20px 20px 8px",
  background: isUser ? "linear-gradient(135deg,#3157B7,#5E78DA)" : "#F8FAFC",
  color: isUser ? "#FFFFFF" : "#0F172A",
  fontSize: 14,
  lineHeight: 1.8,
  border: isUser ? "none" : "1px solid rgba(148,163,184,0.12)",
  boxShadow: isUser ? "0 14px 26px rgba(49,87,183,0.18)" : "none",
});
const thinkingBubbleStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 18,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
};
const thinkingDotStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: "#3157B7" };
const inputWrapStyle: CSSProperties = {
  borderTop: "1px solid rgba(148,163,184,0.12)",
  padding: 16,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  background: "rgba(248,250,252,0.88)",
};
const inputStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "#FFFFFF",
  padding: "0 18px",
  fontSize: 14,
  color: "#0F172A",
};
const sendButtonStyle = (disabled: boolean): CSSProperties => ({
  width: 54,
  height: 54,
  borderRadius: 18,
  border: "none",
  display: "grid",
  placeItems: "center",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg,#3157B7,#5E78DA)",
  color: "#FFFFFF",
  boxShadow: disabled ? "none" : "0 16px 30px rgba(49,87,183,0.2)",
});
const modeHeroStyle: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "linear-gradient(135deg, rgba(49,87,183,0.12), rgba(94,120,218,0.08))",
  border: "1px solid rgba(49,87,183,0.12)",
  display: "grid",
  gap: 10,
};
const modeEyebrowStyle: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5470D9" };
const modeHeadingStyle: CSSProperties = { fontSize: 26, lineHeight: 1.15, fontWeight: 900, color: "#0F172A" };
const modeBodyStyle: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.8, color: "#475569" };
const modeToneStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.9)",
  color: "#3157B7",
  fontSize: 12,
  fontWeight: 800,
};
const summaryCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 18,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.12)",
  display: "grid",
  gap: 10,
};
const summaryEyebrowStyle: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94A3B8" };
const summaryRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "108px 1fr",
  gap: 12,
  alignItems: "start",
  paddingTop: 10,
  borderTop: "1px solid rgba(148,163,184,0.08)",
};
const summaryLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#64748B" };
const summaryValueStyle: CSSProperties = { fontSize: 13, lineHeight: 1.7, color: "#0F172A", fontWeight: 700 };
const confirmButtonStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 20,
  border: "none",
  background: "linear-gradient(135deg,#3157B7,#5E78DA)",
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 900,
  boxShadow: "0 18px 36px rgba(49,87,183,0.24)",
};

