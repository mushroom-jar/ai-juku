"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, AlertTriangle, BookOpen, X, Trophy, Camera } from "lucide-react";
import { refreshXpBar } from "@/app/components/XpBar";
import { SUBJECT_LABEL } from "@/lib/types";

type Book = {
  id: string;
  title: string;
  subject: string;
  level: number;
  level_label: string;
  total_problems: number;
  source: string;
};

type AttemptSlot = {
  result: "perfect" | "unsure" | "checked" | "wrong" | null;
  recorded_at: string | null;
};

const RESULTS = [
  { value: "perfect", Icon: Check,        short: "完全", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  { value: "unsure",  Icon: AlertTriangle, short: "不安", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { value: "checked", Icon: BookOpen,      short: "確認", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "wrong",   Icon: X,             short: "不可", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
] as const;

const ATTEMPT_LABELS = ["1回目", "2回目", "3回目"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RecordPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  // key: problem_no → [slot1, slot2, slot3]
  const [problemData, setProblemData] = useState<Record<number, AttemptSlot[]>>({});
  const [startNo, setStartNo] = useState(1);
  const [endNo, setEndNo] = useState(20);
  const [rangeSet, setRangeSet] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // `${problem_no}-${attempt_no}`
  const [showQuestion, setShowQuestion] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/books?q=&source=all`)
      .then((r) => r.json())
      .then((d) => {
        const found = d.books?.find((b: Book) => b.id === bookId);
        if (found) {
          setBook(found);
          setEndNo(Math.min(20, found.total_problems));
        }
      });
  }, [bookId]);

  useEffect(() => {
    if (!rangeSet) return;
    fetch(`/api/problem-results?book_id=${bookId}`)
      .then((r) => r.json())
      .then((d) => {
        // 初期化: 全問題 × 3スロット
        const grouped: Record<number, AttemptSlot[]> = {};
        for (let i = startNo; i <= endNo; i++) {
          grouped[i] = [
            { result: null, recorded_at: null },
            { result: null, recorded_at: null },
            { result: null, recorded_at: null },
          ];
        }
        for (const r of d.results ?? []) {
          if (r.problem_no < startNo || r.problem_no > endNo) continue;
          const idx = (r.attempt_no ?? 1) - 1;
          if (idx >= 0 && idx < 3) {
            grouped[r.problem_no][idx] = { result: r.result, recorded_at: r.recorded_at };
          }
        }
        setProblemData(grouped);
      });
  }, [bookId, rangeSet, startNo, endNo]);

  const handleRecord = async (
    problem_no: number,
    attempt_no: number,
    result: "perfect" | "unsure" | "checked" | "wrong",
  ) => {
    const key = `${problem_no}-${attempt_no}`;
    setSaving(key);

    // 楽観的更新
    setProblemData((prev) => {
      const slots = prev[problem_no]
        ? [...prev[problem_no]]
        : [{ result: null, recorded_at: null }, { result: null, recorded_at: null }, { result: null, recorded_at: null }];
      slots[attempt_no - 1] = { result, recorded_at: new Date().toISOString() };
      return { ...prev, [problem_no]: slots };
    });

    const res = await fetch("/api/problem-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, problem_no, attempt_no, result }),
    });
    const d = await res.json();
    setSaving(null);

    fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: result === "perfect" ? "record_perfect" : "record_any" }),
    }).then(() => refreshXpBar());

    if (d.suggest_question) setShowQuestion(problem_no);
  };

  // サマリー: 最新回次（最後に記録された結果）ごとに集計
  const problemNos = Array.from({ length: endNo - startNo + 1 }, (_, i) => startNo + i);
  const latestResults = problemNos.map((no) => {
    const slots = problemData[no] ?? [];
    // 後ろから最初に結果があるスロットを取得
    for (let i = 2; i >= 0; i--) {
      if (slots[i]?.result) return slots[i].result;
    }
    return null;
  });
  const summary = {
    perfect: latestResults.filter(r => r === "perfect").length,
    unsure:  latestResults.filter(r => r === "unsure").length,
    checked: latestResults.filter(r => r === "checked").length,
    wrong:   latestResults.filter(r => r === "wrong").length,
    total:   latestResults.filter(r => r !== null).length,
  };
  const mastery = problemNos.length > 0
    ? Math.round((summary.perfect / problemNos.length) * 100)
    : 0;

  if (!book) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF1F8" }}>
      <div style={spinnerStyle} />
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#EEF1F8", paddingBottom: 80 }}>
      {/* ヘッダー */}
      <header style={{ background: "linear-gradient(135deg, #3B52B4, #5B73D4)", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link href="/books" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, textDecoration: "none" }}>
            ← 教材一覧へ
          </Link>
          <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: "8px 0 4px", lineHeight: 1.3 }}>
            {book.title}
          </h1>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            {SUBJECT_LABEL[book.subject]} · Lv.{book.level} {book.level_label}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* 問題範囲選択 */}
        {!rangeSet ? (
          <div style={card}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#344054", margin: "0 0 16px" }}>
              記録する問題の範囲を選択
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>開始</label>
                <input type="number" min={1} max={book.total_problems} value={startNo}
                  onChange={(e) => setStartNo(parseInt(e.target.value) || 1)} style={inputStyle} />
              </div>
              <span style={{ color: "#98A2B3", fontSize: 18, marginTop: 20 }}>〜</span>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>終了</label>
                <input type="number" min={startNo} max={book.total_problems} value={endNo}
                  onChange={(e) => setEndNo(parseInt(e.target.value) || startNo)} style={inputStyle} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#98A2B3", margin: "0 0 16px" }}>
              全{book.total_problems}問 · {endNo - startNo + 1}問 × 3回分を記録できます
            </p>
            <button onClick={() => setRangeSet(true)} style={{
              width: "100%", padding: "12px",
              background: "linear-gradient(135deg, #3B52B4, #5B73D4)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              記録を始める
            </button>
          </div>
        ) : (
          <>
            {/* サマリーカード */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#344054" }}>
                  問題 {startNo}〜{endNo}（{problemNos.length}問）
                </span>
                <span style={{ fontSize: 20, fontWeight: 800, color: mastery >= 80 ? "#059669" : "#3B52B4" }}>
                  {mastery}%
                </span>
              </div>
              <div style={{ height: 8, background: "#EEF1F8", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  height: "100%", width: `${mastery}%`,
                  background: mastery >= 80 ? "linear-gradient(90deg,#059669,#10B981)" : "linear-gradient(90deg,#3B52B4,#5B73D4)",
                  borderRadius: 99, transition: "width 0.3s",
                }} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {RESULTS.map((r) => (
                  <div key={r.value} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <r.Icon size={13} strokeWidth={2.2} color={r.color} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{summary[r.value as keyof typeof summary]}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{r.short}</span>
                  </div>
                ))}
              </div>
              {mastery >= 80 && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#ECFDF5", borderRadius: 8, border: "1px solid #A7F3D0", fontSize: 13, fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Trophy size={14} strokeWidth={2.2} /> 80%達成！この範囲はマスターです
                </div>
              )}
            </div>

            {/* 質問誘導 */}
            {showQuestion !== null && (
              <div style={{ ...card, marginBottom: 14, border: "2px solid #FCA5A5", background: "#FEF2F2" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <X size={14} strokeWidth={2.5} /> 問題{showQuestion}が理解できませんでした
                </p>
                <p style={{ fontSize: 12, color: "#667085", margin: "0 0 12px" }}>写真を撮ってAIに質問しましょう</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowQuestion(null)}
                    style={{ flex: 1, padding: "10px", background: "#fff", border: "1px solid #E4E7EC", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#667085" }}>
                    後で
                  </button>
                  <button onClick={() => router.push("/question")}
                    style={{ flex: 2, padding: "10px", background: "#DC2626", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Camera size={13} strokeWidth={2.2} /> 写真で質問する
                  </button>
                </div>
              </div>
            )}

            {/* ── テーブル ── */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {/* テーブルヘッダー */}
              <div style={{
                display: "grid",
                gridTemplateColumns: TABLE_COLS,
                background: "#F8F9FC",
                borderBottom: "2px solid #E4E7EC",
                position: "sticky", top: 0, zIndex: 2,
              }}>
                <div style={thStyle}>#</div>
                <div style={thStyle}>回</div>
                {RESULTS.map((r) => (
                  <div key={r.value} style={{ ...thStyle, color: r.color }}>
                    <r.Icon size={12} strokeWidth={2.5} />
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{r.short}</span>
                  </div>
                ))}
                <div style={{ ...thStyle, fontSize: 9 }}>日付</div>
              </div>

              {/* テーブル行（問題ごとに3行） */}
              {problemNos.map((problem_no, problemIdx) => {
                const slots = problemData[problem_no] ?? [
                  { result: null, recorded_at: null },
                  { result: null, recorded_at: null },
                  { result: null, recorded_at: null },
                ];
                const isLastProblem = problemIdx === problemNos.length - 1;

                return slots.map((slot, attemptIdx) => {
                  const attempt_no = attemptIdx + 1;
                  const key = `${problem_no}-${attempt_no}`;
                  const isFirstAttempt = attemptIdx === 0;
                  const isLastAttempt = attemptIdx === 2;
                  const isSaving = saving === key;
                  const result = slot.result;
                  const resultCfg = result ? RESULTS.find(r => r.value === result) : null;

                  return (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: TABLE_COLS,
                        borderBottom: isLastAttempt && !isLastProblem
                          ? "2px solid #E4E7EC"
                          : "1px solid #F2F4F7",
                        background: resultCfg
                          ? `${resultCfg.bg}70`
                          : isFirstAttempt
                            ? (problemIdx % 2 === 0 ? "#fff" : "#FAFBFC")
                            : (problemIdx % 2 === 0 ? "#FAFBFC" : "#F5F6F9"),
                        transition: "background 0.2s",
                      }}
                    >
                      {/* 問題番号（最初の行のみ表示） */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "8px 2px",
                        fontSize: 12, fontWeight: 800,
                        color: isFirstAttempt ? "#3B52B4" : "transparent",
                        borderRight: "1px solid #F2F4F7",
                      }}>
                        {isFirstAttempt ? problem_no : ""}
                      </div>

                      {/* 回次 */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "8px 2px",
                        fontSize: 9, fontWeight: 700,
                        color: isSaving ? "#9CA3AF" : "#98A2B3",
                        borderRight: "1px solid #F2F4F7",
                      }}>
                        {ATTEMPT_LABELS[attemptIdx]}
                      </div>

                      {/* 結果ボタン × 4 */}
                      {RESULTS.map((r) => {
                        const selected = result === r.value;
                        return (
                          <button
                            key={r.value}
                            onClick={() => handleRecord(problem_no, attempt_no, r.value)}
                            disabled={isSaving}
                            style={{
                              border: "none",
                              borderRight: r.value !== "wrong" ? "1px solid #F2F4F7" : "none",
                              background: selected ? r.bg : "transparent",
                              cursor: isSaving ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              padding: "8px 2px",
                              transition: "background 0.15s",
                            }}
                          >
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%",
                              background: selected ? r.color : "transparent",
                              border: selected ? "none" : "1.5px solid #E4E7EC",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                            }}>
                              <r.Icon size={12} strokeWidth={2.5} color={selected ? "#fff" : "#D1D5DB"} />
                            </div>
                          </button>
                        );
                      })}

                      {/* 日付 */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "8px 4px",
                        fontSize: 10, fontWeight: 600,
                        color: result ? "#667085" : "#C9CDD6",
                        borderLeft: "1px solid #F2F4F7",
                      }}>
                        {result ? formatDate(slot.recorded_at) : "—"}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const TABLE_COLS = "40px 36px 1fr 1fr 1fr 1fr 44px";

const thStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: 2, padding: "8px 2px",
  fontSize: 9, fontWeight: 700, color: "#9CA3AF",
};

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #E4E7EC",
  borderRadius: 14, padding: "14px 16px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  marginBottom: 14,
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

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: "3px solid #EEF1F8", borderTop: "3px solid #3B52B4",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
