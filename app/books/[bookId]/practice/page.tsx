"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, CheckCircle2, Play } from "lucide-react";
import { refreshXpBar } from "@/app/components/XpBar";
import { SUBJECT_LABEL } from "@/lib/types";

type Book = {
  id: string;
  title: string;
  subject: string;
  level: number;
  level_label: string;
  total_problems: number;
};

// null=未回答, true=正解, false=不正解
type Answer = boolean | null;

type Phase = "setup" | "running" | "done";

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PracticePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup
  const [startNo, setStartNo] = useState(1);
  const [endNo, setEndNo] = useState(10);

  // Running — answers は問題番号をキーにした Map
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [totalMs, setTotalMs] = useState(0);
  const sessionStart = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // Done
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/books?q=&source=all`)
      .then((r) => r.json())
      .then((d) => {
        const found = d.books?.find((b: Book) => b.id === bookId);
        if (found) {
          setBook(found);
          setEndNo(Math.min(10, found.total_problems));
        }
      });
  }, [bookId]);

  // タイマー tick
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      setTotalMs(Date.now() - sessionStart.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const problems = Array.from({ length: endNo - startNo + 1 }, (_, i) => startNo + i);

  const handleStart = () => {
    const init: Record<number, Answer> = {};
    for (let i = startNo; i <= endNo; i++) init[i] = null;
    setAnswers(init);
    sessionStart.current = Date.now();
    setTotalMs(0);
    setPhase("running");
  };

  // タップで null → true → false → null と循環
  const toggle = (no: number) => {
    setAnswers((prev) => {
      const cur = prev[no];
      const next: Answer = cur === null ? true : cur === true ? false : null;
      return { ...prev, [no]: next };
    });
  };

  const handleFinish = () => {
    cancelAnimationFrame(rafRef.current);
    setTotalMs(Date.now() - sessionStart.current);
    setPhase("done");
  };

  const handleSave = async () => {
    setSaving(true);
    for (const [noStr, correct] of Object.entries(answers)) {
      if (correct === null) continue;
      await fetch("/api/problem-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          problem_no: Number(noStr),
          result: correct ? "perfect" : "wrong",
        }),
      });
    }
    setSaving(false);
    setSaved(true);
    const count = Object.values(answers).filter(a => a !== null).length;
    if (count > 0) {
      fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "practice", count }),
      }).then(() => refreshXpBar());
    }
  };

  if (!book) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF1F8" }}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  const answered = Object.values(answers).filter((a) => a !== null);
  const correctCount = answered.filter((a) => a === true).length;
  const wrongCount = answered.filter((a) => a === false).length;
  const answeredCount = answered.length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#EEF1F8", paddingBottom: 100 }}>

      {/* ヘッダー */}
      <header style={{ background: "linear-gradient(135deg, #3B52B4, #5B73D4)", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Link href="/books" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, textDecoration: "none" }}>
            ← 教材一覧へ
          </Link>
          <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: "8px 0 2px", lineHeight: 1.3 }}>
            {book.title}
          </h1>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            {SUBJECT_LABEL[book.subject]} · Lv.{book.level} · 演習モード
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── SETUP ── */}
        {phase === "setup" && (
          <div style={card}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#344054", margin: "0 0 20px" }}>
              演習する問題範囲を選択
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>開始</label>
                <input
                  type="number" min={1} max={book.total_problems}
                  value={startNo}
                  onChange={(e) => setStartNo(Math.max(1, parseInt(e.target.value) || 1))}
                  style={inputStyle}
                />
              </div>
              <span style={{ color: "#98A2B3", fontSize: 20, marginTop: 20 }}>〜</span>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>終了</label>
                <input
                  type="number" min={startNo} max={book.total_problems}
                  value={endNo}
                  onChange={(e) => setEndNo(Math.min(book.total_problems, parseInt(e.target.value) || startNo))}
                  style={inputStyle}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#98A2B3", margin: "0 0 20px" }}>
              全{book.total_problems}問 · {endNo - startNo + 1}問を演習します
            </p>
            <button onClick={handleStart} style={{ ...primaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Play size={14} strokeWidth={2.5} /> 演習を開始する
            </button>
          </div>
        )}

        {/* ── RUNNING ── */}
        {phase === "running" && (
          <>
            {/* タイマーバー */}
            <div style={{
              ...card,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <p style={{ fontSize: 11, color: "#98A2B3", margin: "0 0 2px", fontWeight: 600 }}>経過時間</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: "#344054", margin: 0, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(totalMs)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "#98A2B3", margin: "0 0 4px" }}>
                  {answeredCount} / {problems.length} 問回答済み
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: 3 }}><Check size={13} strokeWidth={2.5} /> {correctCount}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", display: "flex", alignItems: "center", gap: 3 }}><X size={13} strokeWidth={2.5} /> {wrongCount}</span>
                </div>
              </div>
            </div>

            {/* 凡例 */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 11, color: "#98A2B3", flexWrap: "wrap", alignItems: "center" }}>
              <span>タップで切り替え：</span>
              <span style={{ color: "#98A2B3" }}>□ 未回答</span>
              <span style={{ color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}><Check size={11} strokeWidth={2.5} /> 正解</span>
              <span style={{ color: "#DC2626", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}><X size={11} strokeWidth={2.5} /> 不正解</span>
            </div>

            {/* 問題グリッド */}
            <div style={{
              ...card,
              marginBottom: 16,
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                gap: 8,
              }}>
                {problems.map((no) => {
                  const ans = answers[no];
                  return (
                    <button
                      key={no}
                      onClick={() => toggle(no)}
                      style={{
                        padding: "10px 4px",
                        borderRadius: 10,
                        border: `2px solid ${ans === true ? "#A7F3D0" : ans === false ? "#FECACA" : "#E4E7EC"}`,
                        background: ans === true ? "#ECFDF5" : ans === false ? "#FEF2F2" : "#F9FAFB",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.1s",
                      }}
                    >
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: ans === true ? "#059669" : ans === false ? "#DC2626" : "#667085",
                      }}>
                        {no}
                      </span>
                      <span style={{ height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {ans === true ? <Check size={14} strokeWidth={2.5} color="#059669" /> : ans === false ? <X size={14} strokeWidth={2.5} color="#DC2626" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 終了ボタン */}
            <button onClick={handleFinish} style={primaryBtn}>
              演習を終了する
            </button>
          </>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <>
            {/* スコアカード */}
            <div style={{
              ...card,
              background: accuracy >= 80
                ? "linear-gradient(135deg, #059669, #10B981)"
                : "linear-gradient(135deg, #3B52B4, #5B73D4)",
              border: "none",
              color: "#fff",
              textAlign: "center",
              padding: "32px 24px",
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 8px" }}>演習完了</p>
              {answeredCount > 0 ? (
                <>
                  <p style={{ fontSize: 56, fontWeight: 900, margin: "0 0 4px" }}>{accuracy}%</p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "0 0 20px" }}>正答率（回答済み{answeredCount}問）</p>
                </>
              ) : (
                <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>回答なし</p>
              )}
              <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>合計時間</p>
                  <p style={{ fontSize: 20, fontWeight: 800, margin: 0, fontFamily: "monospace" }}>{formatTime(totalMs)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>正解</p>
                  <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{correctCount}問</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>不正解</p>
                  <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{wrongCount}問</p>
                </div>
              </div>
            </div>

            {/* 問題別結果 */}
            <div style={{ ...card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #E4E7EC" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#344054", margin: 0 }}>問題別結果</p>
              </div>
              {/* ヘッダー */}
              <div style={{
                display: "grid", gridTemplateColumns: "64px 1fr",
                background: "#F9FAFB",
                borderBottom: "1px solid #E4E7EC",
                padding: "6px 16px",
              }}>
                {["問題", "結果"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3" }}>{h}</span>
                ))}
              </div>
              {/* 行 */}
              {problems.map((no, i) => {
                const ans = answers[no];
                return (
                  <div key={no} style={{
                    display: "grid", gridTemplateColumns: "64px 1fr",
                    alignItems: "center",
                    padding: "9px 16px",
                    borderBottom: i < problems.length - 1 ? "1px solid #E4E7EC" : "none",
                    background: ans === true ? "#F0FDF4" : ans === false ? "#FFF7F7" : "#fff",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#344054" }}>第{no}問</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {ans === true
                        ? <><Check size={13} color="#059669" strokeWidth={2.5} /><span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>正解</span></>
                        : ans === false
                        ? <><X size={13} color="#DC2626" strokeWidth={2.5} /><span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>不正解</span></>
                        : <span style={{ fontSize: 12, color: "#98A2B3" }}>未回答</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 保存 */}
            {saved ? (
              <div style={{ ...card, textAlign: "center", background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#059669", margin: "0 0 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <CheckCircle2 size={15} strokeWidth={2.2} /> 記録を保存しました
                </p>
                <button onClick={() => router.push("/books")} style={primaryBtn}>
                  教材一覧へ戻る
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "保存中..." : "記録を保存する"}
                </button>
                <button
                  onClick={() => { setPhase("setup"); setSaved(false); }}
                  style={{ padding: "13px", background: "#fff", border: "1px solid #E4E7EC", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#667085", cursor: "pointer" }}
                >
                  もう一度演習する
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E4E7EC",
  borderRadius: 16,
  padding: "20px 18px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#344054", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  border: "1px solid #D0D5DD", borderRadius: 8,
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "14px",
  background: "linear-gradient(135deg, #3B52B4, #5B73D4)",
  color: "#fff", border: "none", borderRadius: 10,
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: "3px solid #EEF1F8", borderTop: "3px solid #3B52B4",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
