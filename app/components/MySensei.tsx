"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ClipboardList,
  GraduationCap,
  ImagePlus,
  Library,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";

const STARTER_PROMPTS = [
  "今日の優先順位を3つに絞って",
  "最近の弱点を整理して",
  "次の90分プランを作って",
  "解けない問題の相談をしたい",
] as const;

type Session = { id: string; title: string; last_message_at: string | null; created_at: string };
type DbMessage = { id: string; role: string; content: string; kind: string | null; created_at: string };
type Message = {
  role: "user" | "ai";
  content: string;
  action?: { type: string; label: string } | null;
  kind?: "chat" | "question";
  imagePreview?: string | null;
};
type SenseiMode = "chat" | "question";

const INITIAL_CHAT: Message = {
  role: "ai",
  kind: "chat",
  content:
    "永愛塾のMy先生です。今日は何を進めるとよさそうか、今の弱点はどこか、次に何をやると前に進めるかを一緒に整理できます。気になっていることをそのまま書いてください。",
};

const INITIAL_QUESTION: Message = {
  role: "ai",
  kind: "question",
  content: "質問モードです。問題文を文字で書くか、写真を添付して送ってください。考え方、解き方、次に見直す点まで整理して返します。",
};

const ACTION_ROUTES: Record<string, { href: string; Icon: React.ElementType }> = {
  record: { href: "/books", Icon: ClipboardList },
  practice: { href: "/shelf", Icon: Timer },
  shelf: { href: "/shelf", Icon: Library },
  schedule: { href: "/schedule", Icon: CalendarDays },
  question: { href: "/my-sensei?mode=question", Icon: Camera },
};

function formatSessionDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function mapDbMessages(msgs: DbMessage[]): Message[] {
  return msgs.map((m) => ({
    role: (m.role === "model" ? "ai" : "user") as "user" | "ai",
    content: m.content,
    kind: (m.kind === "question" ? "question" : "chat") as "chat" | "question",
  }));
}

export default function MySensei() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<Message[]>([INITIAL_CHAT]);
  const [questionMessages, setQuestionMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SenseiMode>("chat");
  const [questionText, setQuestionText] = useState("");
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionPreview, setQuestionPreview] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstMessage = useRef(true);
  const bootstrappedQuery = useRef<string | null>(null);
  const bootstrappedMode = useRef<string | null>(null);

  const visibleMessages =
    mode === "chat" ? chatMessages : questionMessages.length > 0 ? questionMessages : [INITIAL_QUESTION];

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, questionMessages, loading, questionLoading]);

  // Initialize sessions on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setSessionsLoading(true);
      try {
        const res = await fetch("/api/chat-sessions");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { sessions: Session[] };
        const list = data.sessions ?? [];
        if (cancelled) return;
        setSessions(list);

        if (list.length > 0) {
          const first = list[0];
          setActiveSessionId(first.id);
          const msgsRes = await fetch(`/api/chat-sessions/${first.id}`);
          if (!msgsRes.ok || cancelled) return;
          const msgsData = (await msgsRes.json()) as { messages: DbMessage[] };
          const loaded = mapDbMessages(msgsData.messages ?? []);
          if (cancelled) return;
          setChatMessages(loaded.length > 0 ? loaded : [INITIAL_CHAT]);
          isFirstMessage.current = loaded.length === 0;
        } else {
          const createRes = await fetch("/api/chat-sessions", { method: "POST" });
          if (!createRes.ok || cancelled) return;
          const createData = (await createRes.json()) as { session: Session };
          if (cancelled) return;
          setSessions([createData.session]);
          setActiveSessionId(createData.session.id);
          setChatMessages([INITIAL_CHAT]);
          isFirstMessage.current = true;
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectSession = useCallback(
    async (session: Session) => {
      if (session.id === activeSessionId) return;
      setActiveSessionId(session.id);
      setMessagesLoading(true);
      setInput("");
      setShowSidebar(false);
      isFirstMessage.current = false;
      try {
        const res = await fetch(`/api/chat-sessions/${session.id}`);
        const data = (await res.json()) as { messages: DbMessage[] };
        const loaded = mapDbMessages(data.messages ?? []);
        setChatMessages(loaded.length > 0 ? loaded : [INITIAL_CHAT]);
        isFirstMessage.current = loaded.length === 0;
      } finally {
        setMessagesLoading(false);
      }
    },
    [activeSessionId]
  );

  const handleNewSession = useCallback(async () => {
    const res = await fetch("/api/chat-sessions", { method: "POST" });
    const data = (await res.json()) as { session: Session };
    setSessions((prev) => [data.session, ...prev]);
    setActiveSessionId(data.session.id);
    setChatMessages([INITIAL_CHAT]);
    setInput("");
    setMode("chat");
    setShowSidebar(false);
    isFirstMessage.current = true;
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/chat-sessions/${sessionId}`, { method: "DELETE" });

      let nextSession: Session | null = null;
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId && remaining.length > 0) {
          nextSession = remaining[0];
        }
        return remaining;
      });
      setDeleteConfirmId(null);

      if (activeSessionId === sessionId) {
        if (nextSession) {
          setActiveSessionId((nextSession as Session).id);
          setMessagesLoading(true);
          isFirstMessage.current = false;
          try {
            const res = await fetch(`/api/chat-sessions/${(nextSession as Session).id}`);
            const data = (await res.json()) as { messages: DbMessage[] };
            const loaded = mapDbMessages(data.messages ?? []);
            setChatMessages(loaded.length > 0 ? loaded : [INITIAL_CHAT]);
            if (loaded.length === 0) isFirstMessage.current = true;
          } finally {
            setMessagesLoading(false);
          }
        } else {
          const createRes = await fetch("/api/chat-sessions", { method: "POST" });
          const createData = (await createRes.json()) as { session: Session };
          setSessions([createData.session]);
          setActiveSessionId(createData.session.id);
          setChatMessages([INITIAL_CHAT]);
          isFirstMessage.current = true;
        }
      }
    },
    [activeSessionId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !activeSessionId) return;

      const userMsg: Message = { role: "user", content: trimmed, kind: "chat" };
      setChatMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const shouldUpdateTitle = isFirstMessage.current;
      isFirstMessage.current = false;

      try {
        const res = await fetch("/api/sensei", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, message: trimmed }),
        });
        const data = (await res.json()) as { reply: string; action?: { type: string; label: string } | null; error?: string };
        if (!res.ok) throw new Error(data.error ?? "unknown error");

        setChatMessages((prev) => [
          ...prev,
          { role: "ai", content: data.reply, action: data.action ?? null, kind: "chat" },
        ]);

        const now = new Date().toISOString();
        if (shouldUpdateTitle) {
          const newTitle = trimmed.slice(0, 28) + (trimmed.length > 28 ? "…" : "");
          void fetch(`/api/chat-sessions/${activeSessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          });
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? { ...s, title: newTitle, last_message_at: now } : s))
          );
        } else {
          setSessions((prev) =>
            [...prev.map((s) => (s.id === activeSessionId ? { ...s, last_message_at: now } : s))].sort(
              (a, b) =>
                new Date(b.last_message_at ?? b.created_at).getTime() -
                new Date(a.last_message_at ?? a.created_at).getTime()
            )
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "うまく返答できませんでした";
        setChatMessages((prev) => [...prev, { role: "ai", content: `エラー: ${msg}`, kind: "chat" }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, activeSessionId]
  );

  const sendQuestion = useCallback(async () => {
    const trimmed = questionText.trim();
    if ((!trimmed && !questionImage) || questionLoading) return;

    const preview = questionPreview;
    const content = trimmed || "画像の問題を見て教えてください。";
    setQuestionMessages((prev) => [...prev, { role: "user", content, kind: "question", imagePreview: preview }]);
    setQuestionLoading(true);
    setQuestionText("");
    setQuestionImage(null);
    setQuestionPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const formData = new FormData();
      if (trimmed) formData.append("question", trimmed);
      if (questionImage) formData.append("image", questionImage);
      const res = await fetch("/api/question", { method: "POST", body: formData });
      const data = (await res.json()) as { answer?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "質問を処理できませんでした");
      setQuestionMessages((prev) => [...prev, { role: "ai", content: data.answer ?? "", kind: "question" }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "質問を処理できませんでした";
      setQuestionMessages((prev) => [...prev, { role: "ai", content: `エラー: ${msg}`, kind: "question" }]);
    } finally {
      setQuestionLoading(false);
    }
  }, [questionText, questionImage, questionPreview, questionLoading]);

  // Sync mode from URL
  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (bootstrappedMode.current === requestedMode) return;
    bootstrappedMode.current = requestedMode;
    setMode(requestedMode === "question" ? "question" : "chat");
  }, [searchParams]);

  // Bootstrap query from URL
  useEffect(() => {
    const query = searchParams.get("query");
    if (!query || bootstrappedQuery.current === query) return;
    bootstrappedQuery.current = query;
    void sendMessage(query);
    router.replace("/my-sensei");
  }, [router, searchParams, sendMessage]);

  const setModeAndUrl = useCallback(
    (nextMode: SenseiMode) => {
      setMode(nextMode);
      router.replace(nextMode === "question" ? "/my-sensei?mode=question" : "/my-sensei");
    },
    [router]
  );

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 64px)",
        padding: "18px 16px 80px",
        background: "transparent",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        {/* Header */}
        <section
          style={{
            borderRadius: 22,
            padding: "16px 22px",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            color: "#111827",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6B7280",
              }}
            >
              Personal Coach
            </p>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, lineHeight: 1.2, color: "#111827" }}>My先生に相談する</h1>
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
        </section>

        {/* Sessions sidebar + chat */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "220px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Sessions sidebar */}
          <aside
            style={{
              borderRadius: 22,
              overflow: "hidden",
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
              display: isMobile && !showSidebar ? "none" : undefined,
            }}
          >
            <div
              style={{
                padding: "12px 12px 10px",
                borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
              }}
            >
              <button
                onClick={() => void handleNewSession()}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #3B52B4, #5B73D4)",
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <Plus size={15} strokeWidth={2.5} />
                新しいチャット
              </button>
            </div>

            <div style={{ padding: "8px", maxHeight: 560, overflowY: "auto" }}>
              {sessionsLoading ? (
                <div style={{ padding: "16px 12px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                  読み込み中...
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: "16px 12px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                  チャットはありません
                </div>
              ) : (
                sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    isConfirmingDelete={deleteConfirmId === session.id}
                    onSelect={() => void handleSelectSession(session)}
                    onDeleteRequest={() => setDeleteConfirmId(session.id)}
                    onDeleteConfirm={() => void handleDeleteSession(session.id)}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Chat area */}
          <section
            style={{
              borderRadius: 22,
              overflow: "hidden",
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
              minHeight: 640,
              display: isMobile && showSidebar ? "none" : "flex",
              flexDirection: "column",
            }}
          >
            {/* Chat header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#F8FAFC",
                color: "#111827",
              }}
            >
              {isMobile ? (
                <button
                  onClick={() => setShowSidebar(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#475467" }}
                >
                  <ArrowLeft size={18} strokeWidth={2.2} />
                </button>
              ) : null}
              {mode === "chat" ? (
                <GraduationCap size={18} strokeWidth={2.2} color="#3157B7" />
              ) : (
                <Camera size={18} strokeWidth={2.2} color="#BE185D" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {mode === "chat" ? "相談モード" : "質問モード"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  {mode === "chat"
                    ? "会話しながら、その場で次の一歩を決められます"
                    : "文字入力でも、写真つきでも質問できます"}
                </div>
              </div>
              <Sparkles size={16} color={mode === "chat" ? "#3157B7" : "#BE185D"} />
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              {messagesLoading ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>読み込み中...</span>
                </div>
              ) : (
                <>
                  {visibleMessages.map((message, index) => (
                    <MessageBubble key={index} message={message} onAction={(href) => router.push(href)} />
                  ))}
                  {mode === "chat" && chatMessages.length === 1 && !messagesLoading ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 12 }}>
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => void sendMessage(prompt)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "1px solid rgba(59,82,180,0.2)",
                            background: "#F0F4FF",
                            color: "#1D4ED8",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

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
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#94A3B8",
                            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="今日やること、弱点、相談したいことをそのまま書いてください"
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
              <div
                style={{
                  padding: "12px 14px",
                  borderTop: "1px solid var(--border)",
                  display: "grid",
                  gap: 10,
                  background: "#FFFFFF",
                }}
              >
                {questionPreview ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={questionPreview}
                      alt="selected"
                      style={{
                        width: 96,
                        height: 96,
                        objectFit: "cover",
                        borderRadius: 14,
                        border: "1px solid rgba(148, 163, 184, 0.16)",
                      }}
                    />
                    <button
                      onClick={() => {
                        setQuestionImage(null);
                        setQuestionPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        background: "#fff",
                        borderRadius: 10,
                        padding: "8px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475467",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <X size={13} />
                      画像を外す
                    </button>
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendQuestion();
                      }
                    }}
                    placeholder="問題文や、どこが分からないかを書いてください"
                    disabled={questionLoading}
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
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: "#FFF1F3",
                      border: "1px solid rgba(190,24,93,0.16)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="写真を追加"
                  >
                    <ImagePlus size={16} color="#BE185D" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setQuestionImage(file);
                      if (questionPreview) URL.revokeObjectURL(questionPreview);
                      setQuestionPreview(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                  <button
                    onClick={() => void sendQuestion()}
                    disabled={questionLoading || (!questionText.trim() && !questionImage)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      flexShrink: 0,
                      background:
                        questionText.trim() || questionImage
                          ? "linear-gradient(135deg, #BE185D, #E11D48)"
                          : "#E5E7EB",
                      border: "none",
                      cursor: questionText.trim() || questionImage ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Send size={16} color={questionText.trim() || questionImage ? "#fff" : "#94A3B8"} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
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

function SessionItem({
  session,
  isActive,
  isConfirmingDelete,
  onSelect,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  session: Session;
  isActive: boolean;
  isConfirmingDelete: boolean;
  onSelect: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        marginBottom: 4,
        background: isActive ? "#EEF4FF" : hovered ? "#F8FAFC" : "transparent",
        border: isActive ? "1px solid rgba(59,82,180,0.18)" : "1px solid transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onSelect}
        style={{
          width: "100%",
          display: "block",
          textAlign: "left",
          padding: "10px 36px 10px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: isActive ? 800 : 600,
            color: isActive ? "#1D4ED8" : "#1E293B",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <MessageSquare size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
          {session.title}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
          {formatSessionDate(session.last_message_at ?? session.created_at)}
        </div>
      </button>

      {isConfirmingDelete ? (
        <div
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 4,
          }}
        >
          <button
            onClick={onDeleteConfirm}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              background: "#EF4444",
              color: "#fff",
              border: "none",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            削除
          </button>
          <button
            onClick={onDeleteCancel}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              background: "#E5E7EB",
              color: "#374151",
              border: "none",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      ) : hovered ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRequest();
          }}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 24,
            height: 24,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={12} color="#94A3B8" />
        </button>
      ) : null}
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: Message;
  onAction: (href: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {message.imagePreview ? (
        <div style={{ marginBottom: 6, maxWidth: "88%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.imagePreview}
            alt="question"
            style={{ width: 180, borderRadius: 14, border: "1px solid rgba(148, 163, 184, 0.16)" }}
          />
        </div>
      ) : null}
      <div
        style={{
          maxWidth: "88%",
          padding: "10px 13px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser
            ? message.kind === "question"
              ? "linear-gradient(135deg, #BE185D, #E11D48)"
              : "linear-gradient(135deg, #3B52B4, #5B73D4)"
            : "#F8FAFC",
          color: isUser ? "#fff" : "#0F172A",
          fontSize: 14,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          border: isUser ? "none" : "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        {message.content}
      </div>
      {message.action && ACTION_ROUTES[message.action.type] ? (
        (() => {
          const { href, Icon } = ACTION_ROUTES[message.action.type];
          return (
            <button
              onClick={() => onAction(href)}
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
        })()
      ) : null}
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
