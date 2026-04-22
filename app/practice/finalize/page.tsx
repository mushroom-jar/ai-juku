"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { ArrowLeft, BookOpen, Save } from "lucide-react";
import { SUBJECT_LABEL } from "@/lib/types";

const SUBJECT_OPTIONS = Object.entries(SUBJECT_LABEL);

type Draft = {
  title: string;
  practiceMode: "book" | "free" | "time";
  bookId: string | null;
  bookTitle: string | null;
  subject: string | null;
  studyMinutes: number;
  startedAt: string | null;
  endedAt: string;
  resultSummary: Array<{ label: string; attempts: Array<string | null> }> | null;
};

export default function PracticeFinalizePage() {
  const router = useRouter();
  const [draft] = useState<Draft | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("practiceFinalizeDraft");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Draft;
    } catch {
      return null;
    }
  });
  const [title, setTitle] = useState(() => draft?.title ?? "");
  const [saveAsBook, setSaveAsBook] = useState(false);
  const [bookTitle, setBookTitle] = useState(() => draft?.title ?? "");
  const [bookSubject, setBookSubject] = useState(() => draft?.subject ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) {
      router.replace("/practice");
    }
  }, [draft, router]);

  const modeLabel = useMemo(() => {
    if (!draft) return "";
    if (draft.practiceMode === "book") return "教材記録";
    if (draft.practiceMode === "free") return "自由記録";
    return "時間だけ記録";
  }, [draft]);

  const summaryRows = useMemo(() => {
    if (!draft) return [];
    return [
      { label: "記録モード", value: modeLabel },
      { label: "勉強時間", value: `${draft.studyMinutes}分` },
      { label: "教材", value: draft.bookTitle ?? "教材なし" },
      {
        label: "結果の記録",
        value: draft.resultSummary && draft.resultSummary.length > 0 ? `${draft.resultSummary.length}件` : "なし",
      },
    ];
  }, [draft, modeLabel]);

  const canSaveAsBook = draft?.practiceMode === "free" && (draft?.resultSummary?.length ?? 0) > 0;

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);

    // 教材として保存する場合、先に book を作成
    let resolvedBookId = draft.bookId;
    if (saveAsBook && canSaveAsBook && bookTitle.trim() && bookSubject) {
      const totalProblems = draft.resultSummary?.length ?? 1;
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle.trim(),
          subject: bookSubject,
          level: 1,
          total_problems: totalProblems,
          category: "その他",
          visibility: "private",
        }),
      });
      if (res.ok) {
        const json = await res.json();
        resolvedBookId = json.id ?? null;
      }
    }

    await fetch("/api/practice-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: resolvedBookId,
        title: title.trim() || draft.title,
        studyMinutes: draft.studyMinutes,
        startedAt: draft.startedAt,
        endedAt: draft.endedAt,
        resultSummary: draft.resultSummary,
      }),
    });

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("practiceFinalizeDraft");
    }

    router.replace("/timeline?scope=self");
  };

  if (!draft) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 16px 100px" }}>
          <div style={cardStyle}>保存する記録を読み込み中です。</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 100px", display: "grid", gap: 16 }}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Finalize</p>
          <h1 style={titleStyle}>最後に題名を決めて保存する</h1>
          <p style={descriptionStyle}>この1回の記録に名前を付けておくと、タイムラインや履歴であとから見返しやすくなります。</p>
        </section>

        <section style={cardStyle}>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle}>保存する題名</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={draft.title}
              style={inputStyle}
            />
            <p style={helperStyle}>例: 青チャート数I / 学校プリント / 放課後の自習</p>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={summaryGridStyle}>
            {summaryRows.map((row) => (
              <div key={row.label} style={summaryItemStyle}>
                <span style={summaryLabelStyle}>{row.label}</span>
                <span style={summaryValueStyle}>{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 教材として保存するか（自由演習のみ） */}
        {canSaveAsBook && (
          <section style={cardStyle}>
            <button
              type="button"
              onClick={() => setSaveAsBook((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: saveAsBook ? "2px solid #2563EB" : "2px solid #CBD5E1",
                background: saveAsBook ? "#2563EB" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {saveAsBook && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>この演習シートを教材として保存する</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>今後の記録でこの教材を呼び出せるようになります</div>
              </div>
            </button>

            {saveAsBook && (
              <div style={{ display: "grid", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <BookOpen size={14} color="#2563EB" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB" }}>教材の情報</span>
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelStyle}>教材名</span>
                  <input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="例: 青チャート数II"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelStyle}>科目</span>
                  <select
                    value={bookSubject}
                    onChange={(e) => setBookSubject(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">— 選択してください —</option>
                    {SUBJECT_OPTIONS.map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/practice")} style={ghostButtonStyle}>
            <ArrowLeft size={15} />
            記録画面へ戻る
          </button>
          <button onClick={() => void handleSave()} disabled={saving} style={primaryButtonStyle}>
            <Save size={15} />
            {saving ? "保存中..." : "この題名で保存する"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

const heroStyle: CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
};

const cardStyle: CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" };
const titleStyle: CSSProperties = { margin: "8px 0 0", fontSize: 28, lineHeight: 1.15, color: "#0F172A" };
const descriptionStyle: CSSProperties = { margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "#64748B", maxWidth: 640 };

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" };
const helperStyle: CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 };
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const summaryItemStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 14,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
};

const summaryLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 800, color: "var(--text-muted)" };
const summaryValueStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "var(--text-primary)" };

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, var(--accent), #5B73D4)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#fff",
  color: "var(--text-secondary)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
