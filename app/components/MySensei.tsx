"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ClipboardList,
  GraduationCap,
  ImagePlus,
  Library,
  Send,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

type Message = {
  role: "user" | "ai";
  content: string;
  action?: { type: string; label: string } | null;
  kind?: "chat" | "question";
  imagePreview?: string | null;
};

type SenseiMode = "chat" | "question";

const ACTION_ROUTES: Record<string, { href: string; Icon: React.ElementType }> = {
  record: { href: "/books", Icon: ClipboardList },
  practice: { href: "/shelf", Icon: Timer },
  shelf: { href: "/shelf", Icon: Library },
  schedule: { href: "/schedule", Icon: CalendarDays },
  question: { href: "/my-sensei?mode=question", Icon: Camera },
};

const INITIAL_MESSAGE: Message = {
  role: "ai",
  kind: "chat",
  content:
    "永愛塾の My先生です。今日は何を進めるとよさそうか、今の弱点はどこか、次に何をやると前に進めるかを一緒に整理できます。気になっていることをそのまま書いてください。",
};

const QUESTION_INITIAL_MESSAGE: Message = {
  role: "ai",
  kind: "question",
  content:
    "質問モードです。問題文を文字で書くか、写真を添付して送ってください。考え方、解き方、次に見直す点まで整理して返します。",
};

const STARTER_PROMPTS = [
  "今日の優先順位を3つに絞って",
  "最近の弱点を整理して",
  "次の90分プランを作って",
  "解けない問題の相談をしたい",
] as const;

const QUESTION_STARTERS = [
  "この問題の考え方を教えて",
  "どこで式変形を間違えたか知りたい",
  "まず何から考えるべきか教えて",
  "写真を送るので解き方を順番に教えて",
] as const;

export default function MySensei() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SenseiMode>("chat");
  const [questionText, setQuestionText] = useState("");
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionPreview, setQuestionPreview] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bootstrappedQuery = useRef<string | null>(null);
  const bootstrappedMode = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, questionLoading]);

  const setModeAndUrl = useCallback(
    (nextMode: SenseiMode) => {
      setMode(nextMode);
      router.replace(nextMode === "question" ? "/my-sensei?mode=question" : "/my-sensei");
    },
    [router]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { role: "user", content: trimmed, kind: "chat" };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);

      try {
        const apiMessages = nextMessages
          .filter((message) => message.kind !== "question")
          .map((message) => ({
            role: message.role === "user" ? "user" : "model",
            content: message.content,
          }));

        const response = await fetch("/api/sensei", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, pathname }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "unknown error");
        setMessages((prev) => [...prev, { role: "ai", content: data.reply, action: data.action, kind: "chat" }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "うまく返答できませんでした";
        setMessages((prev) => [...prev, { role: "ai", content: `エラー: ${message}`, kind: "chat" }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, pathname]
  );

  const sendQuestion = useCallback(async () => {
    const trimmed = questionText.trim();
    if ((!trimmed && !questionImage) || questionLoading) return;

    const preview = questionPreview;
    const content = trimmed || "画像の問題を見て教えてください。";
    setMessages((prev) => [...prev, { role: "user", content, kind: "question", imagePreview: preview }]);
    setQuestionLoading(true);

    try {
      const formData = new FormData();
      if (trimmed) formData.append("question", trimmed);
      if (questionImage) formData.append("image", questionImage);

      const response = await fetch("/api/question", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.error ?? "質問を処理できませんでした");

      setMessages((prev) => [...prev, { role: "ai", content: data.answer, kind: "question" }]);
      setQuestionText("");
      setQuestionImage(null);
      setQuestionPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : "質問を処理できませんでした";
      setMessages((prev) => [...prev, { role: "ai", content: `エラー: ${message}`, kind: "question" }]);
    } finally {
      setQuestionLoading(false);
    }
  }, [questionImage, questionLoading, questionPreview, questionText]);

  const starterCards = useMemo(
    () =>
      STARTER_PROMPTS.map((prompt) => ({
        label: prompt,
        action: () => void sendMessage(prompt),
      })),
    [sendMessage]
  );

  const questionCards = useMemo(
    () =>
      QUESTION_STARTERS.map((prompt) => ({
        label: prompt,
        action: () => setQuestionText(prompt),
      })),
    []
  );

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (bootstrappedMode.current === requestedMode) return;
    bootstrappedMode.current = requestedMode;
    if (requestedMode === "question") {
      setMode("question");
    } else {
      setMode("chat");
    }
  }, [searchParams]);

  useEffect(() => {
    const query = searchParams.get("query");
    if (!query || bootstrappedQuery.current === query) return;
    bootstrappedQuery.current = query;
    void sendMessage(query);
    router.replace("/my-sensei");
  }, [router, searchParams, sendMessage]);

  const visibleMessages = messages.filter((message) => message.kind === mode || (!message.kind && mode === "chat"));

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 64px)",
        padding: "18px 16px 112px",
        background: "transparent",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <section
          style={{
            borderRadius: 22,
            padding: 22,
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            color: "#111827",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B7280" }}>
                Personal Coach
              </p>
              <h1 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.15, color: "#111827" }}>My先生に相談する</h1>
              <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.75, maxWidth: 620, color: "#6B7280" }}>
                相談モードでは勉強の進め方を、質問モードでは文字や写真つきで問題を聞けます。1つの場所でそのまま切り替えられます。
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setModeAndUrl("chat")} style={modeChipStyle(mode === "chat")}>
                <GraduationCap size={14} />
                相談モード
              </button>
              <button onClick={() => setModeAndUrl("question")} style={modeChipStyle(mode === "question")}>
                <Camera size={14} />
                質問モード
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "0.75fr 1.25fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <aside
            style={{
              borderRadius: 24,
              padding: 18,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: mode === "chat" ? "#EEF4FF" : "#FFF1F3",
                  color: mode === "chat" ? "#1D4ED8" : "#BE185D",
                }}
              >
                {mode === "chat" ? <GraduationCap size={19} /> : <Camera size={18} />}
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{mode === "chat" ? "すぐに相談できること" : "すぐに質問できること"}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  {mode === "chat" ? "学習の進め方や弱点整理に使えます" : "問題の考え方や解き方を聞けます"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {(mode === "chat" ? starterCards : questionCards).map((card) => (
                <button
                  key={card.label}
                  onClick={card.action}
                  style={{
                    textAlign: "left",
                    borderRadius: 18,
                    padding: "14px 15px",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    background: mode === "chat" ? "#F8FAFF" : "#FFF7F8",
                    cursor: "pointer",
                    color: "#0F172A",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.55,
                  }}
                >
                  {card.label}
                </button>
              ))}
            </div>
          </aside>

          <section
            style={{
              borderRadius: 22,
              overflow: "hidden",
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
              minHeight: 640,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#F8FAFC",
                color: "#111827",
              }}
            >
              {mode === "chat" ? <GraduationCap size={18} strokeWidth={2.2} color="#3157B7" /> : <Camera size={18} strokeWidth={2.2} color="#BE185D" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{mode === "chat" ? "相談モード" : "質問モード"}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  {mode === "chat" ? "会話しながら、その場で次の一歩を決められます" : "文字入力でも、写真つきでも質問できます"}
                </div>
              </div>
              <Sparkles size={16} color={mode === "chat" ? "#3157B7" : "#BE185D"} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              {(visibleMessages.length === 0 && mode === "question") ? [QUESTION_INITIAL_MESSAGE].map((message, index) => (
                <div key={`initial-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ maxWidth: "88%", padding: "10px 13px", borderRadius: "16px 16px 16px 4px", background: "#F8FAFC", color: "#0F172A", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                    {message.content}
                  </div>
                </div>
              )) : null}

              {visibleMessages.map((message, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: message.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 12,
                  }}
                >
                  {message.imagePreview ? (
                    <div style={{ marginBottom: 6, maxWidth: "88%" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={message.imagePreview} alt="question preview" style={{ width: 180, borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.16)" }} />
                    </div>
                  ) : null}
                  <div
                    style={{
                      maxWidth: "88%",
                      padding: "10px 13px",
                      borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: message.role === "user"
                        ? message.kind === "question"
                          ? "linear-gradient(135deg, #BE185D, #E11D48)"
                          : "linear-gradient(135deg, #3B52B4, #5B73D4)"
                        : "#F8FAFC",
                      color: message.role === "user" ? "#fff" : "#0F172A",
                      fontSize: 14,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      border: message.role === "user" ? "none" : "1px solid rgba(148, 163, 184, 0.14)",
                    }}
                  >
                    {message.content}
                  </div>

                  {message.action && ACTION_ROUTES[message.action.type] ? (() => {
                    const { href, Icon } = ACTION_ROUTES[message.action.type];
                    return (
                      <button
                        onClick={() => router.push(href)}
                        style={{
                          marginTop: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 12px",
                          borderRadius: 10,
                          background: "#EEF4FF",
                          border: "1px solid rgba(59,82,180,0.12)",
                          color: "#1D4ED8",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        <Icon size={12} strokeWidth={2.2} />
                        {message.action.label}
                      </button>
                    );
                  })() : null}
                </div>
              ))}

              {loading || questionLoading ? (
                <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "16px 16px 16px 4px",
                      background: "#F8FAFC",
                      border: "1px solid rgba(148, 163, 184, 0.14)",
                    }}
                  >
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#94A3B8",
                            animation: `bounce 1.2s ${index * 0.2}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {mode === "chat" ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  background: "#FFFFFF",
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="今日やること、弱点、質問したい問題などをそのまま書いてください"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "11px 13px",
                    border: "1px solid rgba(148, 163, 184, 0.24)",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                    background: "#F8FAFC",
                    color: "#0F172A",
                  }}
                />
                <button
                  onClick={() => void sendMessage(input)}
                  disabled={loading || !input.trim()}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: input.trim() ? "linear-gradient(135deg, #3B52B4, #5B73D4)" : "#E5E7EB",
                    border: "none",
                    cursor: input.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Send size={16} color={input.trim() ? "#fff" : "#94A3B8"} />
                </button>
              </div>
            ) : (
              <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "grid", gap: 10, background: "#FFFFFF" }}>
                {questionPreview ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={questionPreview} alt="selected question" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.16)" }} />
                    <button
                      onClick={() => {
                        setQuestionImage(null);
                        setQuestionPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{ border: "1px solid rgba(148, 163, 184, 0.24)", background: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#475467", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <X size={13} />
                      画像を外す
                    </button>
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendQuestion();
                      }
                    }}
                    placeholder="問題文や、どこが分からないかを書いてください"
                    disabled={questionLoading}
                    style={{ flex: 1, padding: "11px 13px", border: "1px solid rgba(148, 163, 184, 0.24)", borderRadius: 12, fontSize: 14, outline: "none", background: "#F8FAFC", color: "#0F172A" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "#FFF1F3", border: "1px solid rgba(190,24,93,0.16)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="写真を追加"
                  >
                    <ImagePlus size={16} color="#BE185D" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setQuestionImage(file);
                      if (questionPreview) URL.revokeObjectURL(questionPreview);
                      setQuestionPreview(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                  <button
                    onClick={() => void sendQuestion()}
                    disabled={questionLoading || (!questionText.trim() && !questionImage)}
                    style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: questionText.trim() || questionImage ? "linear-gradient(135deg, #BE185D, #E11D48)" : "#E5E7EB", border: "none", cursor: questionText.trim() || questionImage ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Send size={16} color={questionText.trim() || questionImage ? "#fff" : "#94A3B8"} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

function modeChipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 12px",
    borderRadius: 999,
    border: active ? "none" : "1px solid rgba(148, 163, 184, 0.2)",
    background: active ? "linear-gradient(135deg, #3157B7, #5B73D4)" : "#FFFFFF",
    color: active ? "#fff" : "#475467",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}
