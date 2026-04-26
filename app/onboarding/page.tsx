"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, CheckCircle2, Send, Sparkles, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";

type ChatMessage = { role: "user" | "model"; content: string };
type Status = "chatting" | "extracting" | "confirming" | "saving";

type StudyStyle = "planner" | "steady" | "sprinter" | "mood";
type BiggestBlocker = "start" | "continue" | "questions" | "schedule";
type AiTone = "cheerful" | "calm" | "strict" | "friendly";
type ExamType = "general" | "csat" | "recommendation";

interface ExtractedData {
  name: string;
  grade: 1 | 2 | 3;
  targetUniv: string;
  targetFaculty: string | null;
  examType: ExamType | null;
  targetLevel: number;
  examYear: number;
  subjects: Subject[];
  subjectLevels: Partial<Record<Subject, number>>;
  currentLevel: number;
  lastMockLevel: number | null;
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
    "はじめまして。永愛塾のAI面談です。ここでは、今の学年や志望校、勉強の進み方を一緒に整理して、あなたに合う学習ルートの土台を作ります。まずは学年、志望校、今いちばん不安なことから気軽に教えてください。",
};

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  general: "一般入試",
  csat: "共通テスト利用",
  recommendation: "推薦・総合型",
};

const STYLE_LABEL: Record<StudyStyle, string> = {
  planner: "計画を立てて進めるタイプ",
  steady: "コツコツ積み上げるタイプ",
  sprinter: "短期集中で伸ばすタイプ",
  mood: "気分に合わせて進めるタイプ",
};

const BLOCKER_LABEL: Record<BiggestBlocker, string> = {
  start: "始めるまでに時間がかかる",
  continue: "続けている途中で止まりやすい",
  questions: "分からない所で手が止まりやすい",
  schedule: "何をやるか決めるのが難しい",
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
  2: "共通テスト基礎",
  3: "標準私大・国公立",
  4: "難関大対策",
  5: "最難関大対策",
};

const AI_TONE_LABELS: Record<AiTone, string> = {
  cheerful: "明るく背中を押す",
  calm: "落ち着いて整理する",
  strict: "はっきり優先順位を出す",
  friendly: "やわらかく伴走する",
};

const QUICK_STARTERS = [
  "高2です。英語が苦手です",
  "志望校はまだ未定です",
  "数学と英語が必要です",
  "平日は1時間、休日は3時間くらいです",
];

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

  const stageLabel = useMemo(() => {
    if (status === "extracting") return "内容を整理中";
    if (status === "confirming") return "内容の確認";
    if (status === "saving") return "保存中";
    return "AI面談中";
  }, [status]);

  const progressItems = [
    { label: "話す", active: status === "chatting" || status === "extracting", done: status !== "chatting" },
    { label: "確認", active: status === "confirming", done: status === "saving" },
    { label: "開始", active: status === "saving", done: false },
  ];

  async function sendMessage(prefill?: string) {
    const text = (prefill ?? input).trim();
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
        throw new Error(data.error ?? "AI面談でエラーが起きました。もう一度試してください。");
      }

      if (data.reply) {
        setMessages([...nextMessages, { role: "model", content: data.reply }]);
      }

      if (data.done) {
        setStatus("extracting");
        await extractInterview(nextMessages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI面談でエラーが起きました。");
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
      `学習スタイル: ${STYLE_LABEL[extractedData.studyStyle]}`,
      `つまずきやすい所: ${BLOCKER_LABEL[extractedData.biggestBlocker]}`,
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
      target_faculty: extractedData.targetFaculty ?? null,
      exam_type: extractedData.examType ?? null,
      target_level: extractedData.targetLevel,
      exam_date: `${extractedData.examYear}-01-15`,
      subjects: extractedData.subjects,
      subject_levels: extractedData.subjectLevels ?? null,
      current_level: extractedData.currentLevel,
      last_mock_level: extractedData.lastMockLevel ?? null,
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
        subject_levels: extractedData.subjectLevels ?? null,
        last_mock_level: extractedData.lastMockLevel ?? null,
        exam_type: extractedData.examType ?? null,
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

    window.location.href = "/route";
  }

  return (
    <div style={pageStyle}>
      <div style={layoutStyle}>
        <section style={sidePanelStyle}>
          <button
            onClick={() => router.back()}
            disabled={status === "saving"}
            style={backBtnStyle}
          >
            <ArrowLeft size={15} />
            戻る
          </button>
          <div style={sideIconStyle}>
            <Wand2 size={20} />
          </div>
          <div style={eyebrowStyle}>本格AI面談</div>
          <h1 style={headingStyle}>学習ルートと方針を、AIと一緒に整えましょう。</h1>
          <p style={bodyStyle}>
            5分ほどの会話で、志望校・苦手科目・勉強スタイルを整理します。面談が終わると、あなた専用の学習ルートと毎日の方針が作られます。
          </p>

          <div style={progressWrapStyle}>
            {progressItems.map((item) => (
              <div key={item.label} style={progressItemStyle(item.active, item.done)}>
                <div style={progressDotStyle(item.active, item.done)}>
                  {item.done ? <CheckCircle2 size={14} /> : null}
                </div>
                <span style={progressLabelStyle}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={infoBoxStyle}>
            <div style={infoTitleStyle}>面談後に手に入るもの</div>
            {[
              "あなた専用の学習ルート",
              "優先科目と最初の一週間の方針",
              "My先生があなたの状況を理解した状態",
            ].map((item) => (
              <div key={item} style={infoRowStyle}>
                <Sparkles size={14} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div style={statusCardStyle}>
            <div style={statusTitleStyle}>{stageLabel}</div>
            <div style={statusBodyStyle}>
              {status === "chatting" && "気軽に答えて大丈夫です。短い文章でも問題ありません。"}
              {status === "extracting" && "会話内容から学習方針を整理しています。"}
              {status === "confirming" && "保存前に、整理された内容を一度だけ確認します。"}
              {status === "saving" && "保存して、最初の学習ルートへつないでいます。"}
            </div>
          </div>
        </section>

        <section style={chatCardStyle}>
          <div style={chatHeaderStyle}>
            <div style={chatHeaderLeftStyle}>
              <div style={chatHeaderIconStyle}>
                <Bot size={18} />
              </div>
              <div>
                <div style={chatTitleStyle}>AI面談</div>
                <div style={chatSubStyle}>{stageLabel}</div>
              </div>
            </div>
            <div style={badgeStyle}>{messages.length - 1}件のやり取り</div>
          </div>

          <div style={messageAreaStyle}>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} style={messageRowStyle(message.role === "user")}>
                <div style={messageBubbleStyle(message.role === "user")}>{message.content}</div>
              </div>
            ))}

            {isThinking ? (
              <div style={messageRowStyle(false)}>
                <div style={thinkingBubbleStyle}>AIが内容を整理しています…</div>
              </div>
            ) : null}

            {status === "confirming" && extractedData ? (
              <ModeRevealCard
                data={extractedData}
                onConfirm={handleSave}
                onBack={() => setStatus("chatting")}
                error={error}
              />
            ) : null}

            {status === "saving" ? (
              <div style={savingStyle}>保存しています。数秒だけお待ちください。</div>
            ) : null}

            {error && status === "chatting" ? <div style={errorStyle}>{error}</div> : null}
            <div ref={bottomRef} />
          </div>

          {status === "chatting" ? (
            <>
              <div style={chipWrapStyle}>
                {QUICK_STARTERS.map((starter) => (
                  <button key={starter} type="button" onClick={() => void sendMessage(starter)} style={chipStyle}>
                    {starter}
                  </button>
                ))}
              </div>

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
                  placeholder="ここに答えを入力してください"
                  disabled={isThinking}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isThinking}
                  style={sendButtonStyle(!input.trim() || isThinking)}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ModeRevealCard({
  data,
  onConfirm,
  onBack,
  error,
}: {
  data: ExtractedData;
  onConfirm: () => void;
  onBack: () => void;
  error: string;
}) {
  return (
    <div style={confirmWrapStyle}>
      <div style={modeHeroStyle}>
        <div style={modeEyebrowStyle}>AIが整理した学習タイプ</div>
        <div style={modeHeadingStyle}>{data.mode.name}</div>
        <p style={modeBodyStyle}>{data.mode.description}</p>
        <div style={modeToneStyle}>話し方の雰囲気: {AI_TONE_LABELS[data.mode.aiTone] ?? data.mode.aiTone}</div>
      </div>

      <div style={summaryCardStyle}>
        {[
          { label: "名前", value: `${data.name} / 高${data.grade}` },
          { label: "志望校", value: data.targetUniv || "未設定" },
          data.targetFaculty ? { label: "志望学部", value: data.targetFaculty } : null,
          data.examType ? { label: "受験方式", value: EXAM_TYPE_LABEL[data.examType] ?? data.examType } : null,
          { label: "必要科目", value: data.subjects.map((subject) => SUBJECT_LABEL[subject] ?? subject).join(" / ") || "未設定" },
          { label: "現在レベル", value: `Lv.${data.currentLevel}（${LEVEL_LABELS[data.currentLevel] ?? "未設定"}）` },
          data.lastMockLevel ? { label: "模試の感覚", value: `Lv.${data.lastMockLevel}（${LEVEL_LABELS[data.lastMockLevel] ?? "未設定"}）` } : null,
          { label: "勉強スタイル", value: STYLE_LABEL[data.studyStyle] },
          { label: "止まりやすい所", value: BLOCKER_LABEL[data.biggestBlocker] },
          { label: "勉強時間", value: `平日 ${data.weekdayMinutes}分 / 休日 ${data.holidayMinutes}分` },
        ]
          .filter(Boolean)
          .map((row) => (
            <div key={(row as { label: string }).label} style={summaryRowStyle}>
              <span style={summaryLabelStyle}>{(row as { label: string }).label}</span>
              <span style={summaryValueStyle}>{(row as { value: string }).value}</span>
            </div>
          ))}
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={confirmActionStyle}>
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>
          もう少し話す
        </button>
        <button type="button" onClick={onConfirm} style={confirmButtonStyle}>
          この内容で始める
        </button>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F4F6FB",
  padding: "24px 16px 32px",
};

const layoutStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "320px minmax(0, 1fr)",
  gap: 18,
};

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  background: "transparent",
  color: "#64748B",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
};

const sidePanelStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 16,
  padding: 22,
  borderRadius: 24,
  background: "linear-gradient(180deg, #173274 0%, #2548A2 100%)",
  color: "#FFFFFF",
  boxShadow: "0 18px 40px rgba(23, 50, 116, 0.22)",
};

const sideIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.14)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.8,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 900,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.8,
  opacity: 0.9,
};

const progressWrapStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const progressItemStyle = (active: boolean, done: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
  border: done ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.1)",
});

const progressDotStyle = (active: boolean, done: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: done ? "#D1FAE5" : active ? "#FDE68A" : "rgba(255,255,255,0.18)",
  color: done ? "#047857" : "#173274",
  flexShrink: 0,
});

const progressLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const infoBoxStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const infoTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const infoRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  lineHeight: 1.6,
};

const statusCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const statusTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 6,
};

const statusBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  opacity: 0.9,
};

const chatCardStyle: CSSProperties = {
  borderRadius: 24,
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  boxShadow: "0 18px 34px rgba(15, 23, 42, 0.08)",
  minHeight: 720,
  display: "grid",
  gridTemplateRows: "auto 1fr auto auto",
  overflow: "hidden",
};

const chatHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid #EEF2F7",
  background: "#FBFCFE",
};

const chatHeaderLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const chatHeaderIconStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "#EEF4FF",
  color: "#3157B7",
};

const chatTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0F172A",
};

const chatSubStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748B",
  marginTop: 2,
};

const badgeStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#F1F5F9",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
};

const messageAreaStyle: CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 12,
  alignContent: "start",
  overflowY: "auto",
  background: "#FFFFFF",
};

const messageRowStyle = (isUser: boolean): CSSProperties => ({
  display: "flex",
  justifyContent: isUser ? "flex-end" : "flex-start",
});

const messageBubbleStyle = (isUser: boolean): CSSProperties => ({
  maxWidth: "88%",
  padding: "13px 15px",
  borderRadius: isUser ? "18px 18px 8px 18px" : "18px 18px 18px 8px",
  background: isUser ? "linear-gradient(135deg, #3157B7, #5D78DA)" : "#F8FAFC",
  color: isUser ? "#FFFFFF" : "#0F172A",
  border: isUser ? "none" : "1px solid #E5E7EB",
  fontSize: 14,
  lineHeight: 1.75,
});

const thinkingBubbleStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "#F8FAFC",
  border: "1px solid #E5E7EB",
  fontSize: 13,
  color: "#64748B",
  fontWeight: 700,
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: "0 18px 14px",
};

const chipStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 999,
  border: "1px solid #DCE5F6",
  background: "#F8FAFF",
  color: "#3157B7",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const inputWrapStyle: CSSProperties = {
  padding: 16,
  borderTop: "1px solid #EEF2F7",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  background: "#FBFCFE",
};

const inputStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 16,
  border: "1px solid #D8E0F0",
  background: "#FFFFFF",
  padding: "0 16px",
  fontSize: 14,
  color: "#0F172A",
  outline: "none",
};

const sendButtonStyle = (disabled: boolean): CSSProperties => ({
  width: 52,
  height: 52,
  borderRadius: 16,
  border: "none",
  display: "grid",
  placeItems: "center",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #3157B7, #5D78DA)",
  color: "#FFFFFF",
  cursor: disabled ? "not-allowed" : "pointer",
});

const confirmWrapStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  paddingTop: 4,
};

const modeHeroStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 18,
  borderRadius: 20,
  background: "#EEF4FF",
  border: "1px solid #D5E2FF",
};

const modeEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#5470D9",
};

const modeHeadingStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0F172A",
};

const modeBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.75,
  color: "#475569",
};

const modeToneStyle: CSSProperties = {
  width: "fit-content",
  padding: "8px 10px",
  borderRadius: 999,
  background: "#FFFFFF",
  fontSize: 12,
  fontWeight: 700,
  color: "#3157B7",
};

const summaryCardStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 18,
  borderRadius: 20,
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
};

const summaryRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "112px 1fr",
  gap: 12,
  alignItems: "start",
  paddingTop: 10,
  borderTop: "1px solid #F1F5F9",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const summaryValueStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  fontWeight: 700,
  color: "#0F172A",
};

const confirmActionStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 48,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid #D8E0F0",
  background: "#FFFFFF",
  color: "#334155",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const confirmButtonStyle: CSSProperties = {
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #3157B7, #5D78DA)",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const savingStyle: CSSProperties = {
  textAlign: "center",
  padding: "18px 0",
  color: "#64748B",
  fontSize: 14,
  fontWeight: 700,
};

const errorStyle: CSSProperties = {
  color: "#B42318",
  fontSize: 13,
  fontWeight: 700,
};
