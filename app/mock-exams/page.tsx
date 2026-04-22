"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MockExam } from "@/lib/types";
import { SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";

const COMMON_EXAMS = [
  "全統記述模試（河合塾）",
  "全統共通テスト模試（河合塾）",
  "駿台全国模試",
  "駿台共通テスト模試",
  "進研模試",
  "東進センター本番レベル模試",
];

type FormScores = Record<string, { score: string; max: string; deviation: string }>;

const SUBJECTS = [
  "math", "physics", "chemistry", "biology",
  "english", "japanese", "world_history", "japanese_history",
  "geography", "civics", "information", "other",
] as const;

function initFormScores(): FormScores {
  return Object.fromEntries(
    SUBJECTS.map((s) => [s, { score: "", max: "", deviation: "" }])
  );
}

export default function MockExamsPage() {
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [formScores, setFormScores] = useState<FormScores>(initFormScores());
  const [totalScore, setTotalScore] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [totalDev, setTotalDev] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/mock-exams")
      .then((r) => r.json())
      .then((d) => { setExams(d.exams ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!examName || !examDate) return;
    setSaving(true);

    const scores: MockExam["scores"] = {};
    for (const s of SUBJECTS) {
      const { score, max, deviation } = formScores[s];
      if (score !== "" && max !== "") {
        scores[s] = {
          score: Number(score),
          max: Number(max),
          ...(deviation !== "" ? { deviation: Number(deviation) } : {}),
        };
      }
    }

    const body = {
      exam_name: examName,
      exam_date: examDate,
      scores,
      total_score: totalScore !== "" ? Number(totalScore) : null,
      total_max: totalMax !== "" ? Number(totalMax) : null,
      total_deviation: totalDev !== "" ? Number(totalDev) : null,
      memo: memo || null,
    };

    const res = await fetch("/api/mock-exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.exam) {
      setExams((prev) => [data.exam, ...prev]);
      setShowForm(false);
      setExamName("");
      setExamDate("");
      setFormScores(initFormScores());
      setTotalScore("");
      setTotalMax("");
      setTotalDev("");
      setMemo("");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("この記録を削除しますか？")) return;
    await fetch(`/api/mock-exams/${id}`, { method: "DELETE" });
    setExams((prev) => prev.filter((e) => e.id !== id));
  }

  // 偏差値推移データ（total_deviationがあるもの、古い順）
  const trendData = [...exams]
    .filter((e) => e.total_deviation !== null)
    .reverse();
  const maxDev = Math.max(...trendData.map((e) => Number(e.total_deviation ?? 0)), 80);
  const minDev = Math.min(...trendData.map((e) => Number(e.total_deviation ?? 0)), 40);

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={spinnerStyle} />
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        height: 56,
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>模試記録</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              fontSize: 13, fontWeight: 600,
              padding: "6px 14px",
              background: showForm ? "var(--bg-elevated)" : "linear-gradient(135deg, #3B52B4, #5B73D4)",
              color: showForm ? "var(--text-secondary)" : "#fff",
              border: "none", borderRadius: 8, cursor: "pointer",
            }}
          >
            {showForm ? "キャンセル" : "+ 模試を記録"}
          </button>
          <Link href="/today" style={navBtn}>← ホーム</Link>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* 追加フォーム */}
        {showForm && (
          <div style={{ ...card, marginBottom: 20, borderColor: "#3B52B4" }}>
            <p style={cardTitle}>新規模試を記録</p>

            {/* 模試名 */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>模試名</label>
              <input
                list="exam-suggestions"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="例: 全統記述模試（河合塾）"
                style={inputStyle}
              />
              <datalist id="exam-suggestions">
                {COMMON_EXAMS.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>

            {/* 受験日 */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>受験日</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 科目別スコア */}
            <p style={{ ...labelStyle, marginBottom: 8 }}>科目別スコア（任意）</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {SUBJECTS.map((s) => (
                <div key={s} style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 1fr", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: SUBJECT_COLOR[s] }}>
                    {SUBJECT_LABEL[s]}
                  </span>
                  <input
                    type="number"
                    placeholder="得点"
                    value={formScores[s].score}
                    onChange={(e) => setFormScores((prev) => ({ ...prev, [s]: { ...prev[s], score: e.target.value } }))}
                    style={{ ...inputStyle, margin: 0 }}
                  />
                  <input
                    type="number"
                    placeholder="満点"
                    value={formScores[s].max}
                    onChange={(e) => setFormScores((prev) => ({ ...prev, [s]: { ...prev[s], max: e.target.value } }))}
                    style={{ ...inputStyle, margin: 0 }}
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="偏差値"
                    value={formScores[s].deviation}
                    onChange={(e) => setFormScores((prev) => ({ ...prev, [s]: { ...prev[s], deviation: e.target.value } }))}
                    style={{ ...inputStyle, margin: 0 }}
                  />
                </div>
              ))}
            </div>

            {/* 合計 */}
            <p style={{ ...labelStyle, marginBottom: 8 }}>合計（任意）</p>
            <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 1fr", gap: 6, alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>合計</span>
              <input type="number" placeholder="合計点" value={totalScore} onChange={(e) => setTotalScore(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
              <input type="number" placeholder="満点" value={totalMax} onChange={(e) => setTotalMax(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
              <input type="number" step="0.1" placeholder="偏差値" value={totalDev} onChange={(e) => setTotalDev(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
            </div>

            {/* メモ */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>メモ（任意）</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="気づいた点、次回の目標など"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={!examName || !examDate || saving}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "linear-gradient(135deg, #3B52B4, #5B73D4)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: (!examName || !examDate || saving) ? "not-allowed" : "pointer",
                opacity: (!examName || !examDate || saving) ? 0.6 : 1,
              }}
            >
              {saving ? "保存中…" : "記録する"}
            </button>
          </div>
        )}

        {/* 偏差値推移グラフ */}
        {trendData.length >= 2 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={cardTitle}>📈 総合偏差値の推移</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, position: "relative" }}>
              {/* 目安ライン（偏差値60） */}
              <div style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${((60 - minDev) / (maxDev - minDev + 1)) * 80}px`,
                borderTop: "1px dashed #E0E7FF",
                zIndex: 0,
              }} />
              {trendData.map((e, i) => {
                const dev = Number(e.total_deviation ?? 0);
                const range = maxDev - minDev + 1;
                const height = Math.max(((dev - minDev) / range) * 80 + 4, 8);
                const d = new Date(e.exam_date);
                const label = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 1 }}>
                    <span style={{ fontSize: 9, color: "var(--text-primary)", fontWeight: 700 }}>{dev.toFixed(1)}</span>
                    <div style={{
                      width: "100%",
                      height,
                      background: dev >= 65 ? "linear-gradient(180deg,#10B981,#059669)"
                        : dev >= 55 ? "linear-gradient(180deg,#3B52B4,#5B73D4)"
                          : "linear-gradient(180deg,#F59E0B,#D97706)",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 8,
                    }} />
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 模試一覧 */}
        {exams.length === 0 ? (
          <div style={{
            ...card,
            textAlign: "center",
            padding: "48px 24px",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              模試の記録がありません
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              「+ 模試を記録」から追加してください
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ExamCard({ exam, onDelete }: { exam: MockExam; onDelete: (id: string) => void }) {
  const d = new Date(exam.exam_date);
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  const subjectEntries = Object.entries(exam.scores ?? {});

  return (
    <div style={{ ...card, margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            {exam.exam_name}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{dateStr}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {exam.total_deviation !== null && (
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>総合偏差値</p>
              <p style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: Number(exam.total_deviation) >= 65 ? "#10B981"
                  : Number(exam.total_deviation) >= 55 ? "#3B52B4"
                    : "#F59E0B",
                letterSpacing: -0.5,
              }}>
                {Number(exam.total_deviation).toFixed(1)}
              </p>
            </div>
          )}
          <button
            onClick={() => onDelete(exam.id)}
            style={{
              background: "none", border: "none",
              color: "var(--text-muted)", cursor: "pointer",
              fontSize: 16, padding: "4px",
              lineHeight: 1,
            }}
            title="削除"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 合計点 */}
      {exam.total_score !== null && exam.total_max !== null && (
        <div style={{
          background: "var(--bg-elevated)",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>合計</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {exam.total_score}
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}> / {exam.total_max}</span>
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ({Math.round((exam.total_score / exam.total_max) * 100)}%)
          </span>
        </div>
      )}

      {/* 科目別 */}
      {subjectEntries.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {subjectEntries.map(([subj, val]) => (
            <div key={subj} style={{
              background: "var(--bg-elevated)",
              borderRadius: 8,
              padding: "6px 10px",
              borderLeft: `3px solid ${SUBJECT_COLOR[subj] ?? "#6B7280"}`,
            }}>
              <p style={{ margin: 0, fontSize: 10, color: SUBJECT_COLOR[subj] ?? "#6B7280", fontWeight: 600 }}>
                {SUBJECT_LABEL[subj] ?? subj}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {val.score}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>/{val.max}</span>
                {val.deviation !== undefined && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
                    偏差値{val.deviation.toFixed(1)}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* メモ */}
      {exam.memo && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {exam.memo}
        </p>
      )}
    </div>
  );
}

// Styles
const navBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--accent)",
  textDecoration: "none", padding: "6px 14px",
  background: "var(--accent-light)", borderRadius: 8,
  border: "1px solid var(--accent-border)",
};

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px",
};

const cardTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
  margin: "0 0 14px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12, fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  outline: "none",
  marginBottom: 0,
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: "3px solid var(--border)",
  borderTop: "3px solid #3B52B4",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};
