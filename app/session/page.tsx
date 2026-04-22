"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";
import { Check, X, CheckCircle2, AlertCircle } from "lucide-react";

type UnsolvedTask = {
  id: string;
  date: string;
  status: string;
  problem_no_start: number;
  problem_no_end: number;
  books: { title: string; subject: string } | null;
};

type DaySummary = {
  date: string;
  dayName: string;
  done: boolean;
  title: string;
  problem_no_start: number;
  problem_no_end: number;
};

type SessionData = {
  studentId: string;
  studentName: string;
  unsolvedTasks: UnsolvedTask[];
  weekSummary: DaySummary[];
  completedCount: number;
  totalCount: number;
  aiFeedback: string;
};

type ReviewResult = "solved" | "unsolved";


export default function SessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionData | null>(null);
  const [step, setStep] = useState(1);
  const [reviewResults, setReviewResults] = useState<Record<string, ReviewResult>>({});
  const [isExamWeek, setIsExamWeek] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionResult, setSessionResult] = useState<{ masteryRate: number; passed: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setResult = (taskId: string, result: ReviewResult) => {
    setReviewResults((prev) => ({ ...prev, [taskId]: result }));
  };

  const allAnswered =
    data?.unsolvedTasks.length === 0 ||
    data?.unsolvedTasks.every((t) => reviewResults[t.id] !== undefined);

  const handleComplete = async () => {
    if (!data) return;
    setSubmitting(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: data.studentId,
        reviewResults,
        isExamWeek,
        aiFeedback: data.aiFeedback,
      }),
    });
    const result = await res.json();
    setSessionResult({ masteryRate: result.masteryRate, passed: result.passed });
    setSubmitting(false);
    setDone(true);
  };

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 16 }}>セッションデータを読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={centerStyle}>
        <p style={{ color: "var(--danger)", fontSize: 14 }}>データの取得に失敗しました。</p>
        <button onClick={() => router.push("/today")} style={btnSecondary}>ホームに戻る</button>
      </div>
    );
  }

  if (done && sessionResult) {
    const { masteryRate, passed } = sessionResult;
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{passed ? "🎉" : "💪"}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
          確認テスト結果
        </h2>

        {/* マスター率 */}
        <div style={{
          background: passed ? "#ECFDF3" : "#FEF3F2",
          border: `1px solid ${passed ? "#6CE9A6" : "#FDA29B"}`,
          borderRadius: 16,
          padding: "20px 32px",
          textAlign: "center",
          marginBottom: 20,
          minWidth: 200,
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: passed ? "#027A48" : "#B42318" }}>
            マスター率
          </p>
          <p style={{ margin: 0, fontSize: 48, fontWeight: 800, color: passed ? "#027A48" : "#B42318", letterSpacing: -1 }}>
            {masteryRate}%
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: passed ? "#027A48" : "#B42318" }}>
            {passed ? "合格 → 来週は次の範囲へ進む" : "不合格 → 来週も同じ範囲を繰り返す"}
          </p>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 28px", textAlign: "center", lineHeight: 1.7 }}>
          {passed
            ? "素晴らしい！しっかり定着しています。\n来週は新しい範囲に進みましょう。"
            : "まだ定着が不十分です。焦らず\n同じ範囲をもう一週間やり直しましょう。"}
        </p>

        <button onClick={() => router.push("/today")} style={btnPrimary}>
          ホームへ戻る
        </button>
      </div>
    );
  }

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
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>週次AIセッション</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>STEP {step} / 4</span>
      </header>

      {/* Step indicator */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 6, maxWidth: 600, margin: "0 auto" }}>
          {["確認テスト", "振り返り", "来週の計画", "確定"].map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 4,
                borderRadius: 99,
                background: step > i + 1 ? "var(--success)" : step === i + 1 ? "#3B52B4" : "var(--bg-elevated)",
                marginBottom: 4,
              }} />
              <span style={{
                fontSize: 10,
                color: step === i + 1 ? "#3B52B4" : "var(--text-muted)",
                fontWeight: step === i + 1 ? 700 : 400,
              }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* STEP 1: 確認テスト */}
        {step === 1 && (
          <div>
            <h2 style={stepTitle}>STEP 1：確認テスト</h2>
            <p style={stepDesc}>先週できなかったタスクに再挑戦！解けたものにチェックを入れてください。</p>

            {data.unsolvedTasks.length === 0 ? (
              <div style={emptyCard}>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><CheckCircle2 size={36} color="var(--success)" strokeWidth={1.5} /></div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                  先週のタスクはすべて完了しています！
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.unsolvedTasks.map((task) => {
                  const subject = task.books?.subject ?? "";
                  const color = SUBJECT_COLOR[subject] ?? "#6B7280";
                  const result = reviewResults[task.id];
                  return (
                    <div key={task.id} style={{
                      background: "var(--bg-card)",
                      border: `1px solid ${result ? (result === "solved" ? "var(--success)" : "var(--danger)") : "var(--border)"}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color, background: `${color}18`,
                          padding: "2px 8px", borderRadius: 99,
                        }}>
                          {SUBJECT_LABEL[subject] ?? subject}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                          {task.books?.title ?? ""}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                        問題 {task.problem_no_start}〜{task.problem_no_end}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setResult(task.id, "solved")}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid",
                            fontSize: 13, fontWeight: 700, cursor: "pointer",
                            borderColor: result === "solved" ? "var(--success)" : "var(--border)",
                            background: result === "solved" ? "#D1FAE5" : "var(--bg-elevated)",
                            color: result === "solved" ? "#065F46" : "var(--text-secondary)",
                          }}
                        >
                          <Check size={13} strokeWidth={2.5} style={{ display: "inline", marginRight: 4 }} /> 解けた
                        </button>
                        <button
                          onClick={() => setResult(task.id, "unsolved")}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid",
                            fontSize: 13, fontWeight: 700, cursor: "pointer",
                            borderColor: result === "unsolved" ? "var(--danger)" : "var(--border)",
                            background: result === "unsolved" ? "#FEE2E2" : "var(--bg-elevated)",
                            color: result === "unsolved" ? "#991B1B" : "var(--text-secondary)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          }}
                        >
                          <X size={13} strokeWidth={2.5} /> まだ無理
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setStep(2)}
                disabled={!allAnswered}
                style={allAnswered ? btnPrimary : btnDisabled}
              >
                次へ →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 振り返り */}
        {step === 2 && (
          <div>
            <h2 style={stepTitle}>STEP 2：先週の振り返り</h2>
            <p style={stepDesc}>先週の学習を振り返りましょう。</p>

            {/* Week summary grid */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px",
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 12px" }}>
                達成状況 {data.completedCount} / {data.totalCount} 日
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                {data.weekSummary.map((day, i) => (
                  <div key={i} style={{
                    flex: 1,
                    background: day.done ? "#D1FAE5" : "var(--bg-elevated)",
                    border: `1px solid ${day.done ? "#6EE7B7" : "var(--border)"}`,
                    borderRadius: 8,
                    padding: "8px 4px",
                    textAlign: "center",
                  }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                      {day.done
                        ? <CheckCircle2 size={16} color="#059669" strokeWidth={2} />
                        : <AlertCircle size={16} color="var(--text-muted)" strokeWidth={2} />}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: day.done ? "#065F46" : "var(--text-muted)" }}>
                      {day.dayName}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Feedback */}
            <div style={{
              background: "linear-gradient(135deg, #EEF2FF, #EEF1F8)",
              border: "1px solid #C4CEEA",
              borderRadius: 12,
              padding: "16px",
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#3B52B4", margin: "0 0 8px" }}>
                🤖 AIからのフィードバック
              </p>
              <p style={{ fontSize: 14, color: "#3730A3", lineHeight: 1.7, margin: 0 }}>
                {data.aiFeedback}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={btnSecondary}>← 戻る</button>
              <button onClick={() => setStep(3)} style={{ ...btnPrimary, flex: 1 }}>次へ →</button>
            </div>
          </div>
        )}

        {/* STEP 3: 来週の計画 */}
        {step === 3 && (
          <div>
            <h2 style={stepTitle}>STEP 3：来週の計画</h2>
            <p style={stepDesc}>来週の学習方針を確認しましょう。</p>

            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px",
              marginBottom: 20,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 16px" }}>
                来週のモード設定
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: `1.5px solid ${!isExamWeek ? "#3B52B4" : "var(--border)"}`,
                  background: !isExamWeek ? "#EEF2FF" : "var(--bg-elevated)",
                  cursor: "pointer",
                }}>
                  <input
                    type="radio"
                    name="weekType"
                    checked={!isExamWeek}
                    onChange={() => setIsExamWeek(false)}
                    style={{ width: 16, height: 16, accentColor: "#3B52B4" }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: !isExamWeek ? "#3B52B4" : "var(--text-secondary)" }}>
                      通常週
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      ルートに沿って新しい問題を進める
                    </p>
                  </div>
                </label>

                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: `1.5px solid ${isExamWeek ? "#F59E0B" : "var(--border)"}`,
                  background: isExamWeek ? "#FFFBEB" : "var(--bg-elevated)",
                  cursor: "pointer",
                }}>
                  <input
                    type="radio"
                    name="weekType"
                    checked={isExamWeek}
                    onChange={() => setIsExamWeek(true)}
                    style={{ width: 16, height: 16, accentColor: "#F59E0B" }}
                  />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isExamWeek ? "#B45309" : "var(--text-secondary)" }}>
                      試験週
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      復習中心・負荷を軽減したスケジュール
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={btnSecondary}>← 戻る</button>
              <button onClick={() => setStep(4)} style={{ ...btnPrimary, flex: 1 }}>次へ →</button>
            </div>
          </div>
        )}

        {/* STEP 4: 確定 */}
        {step === 4 && (
          <div>
            <h2 style={stepTitle}>STEP 4：来週の宿題を確定</h2>
            <p style={stepDesc}>内容を確認して、セッションを完了しましょう。</p>

            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px",
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 12px" }}>今週の結果</p>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={summaryChip}>
                  <span style={chipNum}>{data.completedCount}</span>
                  <span style={chipLabel}>完了タスク</span>
                </div>
                <div style={summaryChip}>
                  <span style={chipNum}>{Object.values(reviewResults).filter(v => v === "solved").length}</span>
                  <span style={chipLabel}>確認テスト ✅</span>
                </div>
                <div style={summaryChip}>
                  <span style={chipNum}>{isExamWeek ? "試験週" : "通常週"}</span>
                  <span style={chipLabel}>来週のモード</span>
                </div>
              </div>
            </div>

            <div style={{
              background: "#EEF2FF",
              border: "1px solid #C4CEEA",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 13, color: "#2D3E99", margin: 0 }}>
                ✅ 完了すると来週のスケジュールが自動で作成されます
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={btnSecondary}>← 戻る</button>
              <button
                onClick={handleComplete}
                disabled={submitting}
                style={submitting ? { ...btnDisabled, flex: 1 } : { ...btnSuccess, flex: 1 }}
              >
                {submitting ? "処理中..." : "🚀 セッション完了！"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Styles
const centerStyle: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid var(--border)",
  borderTop: "3px solid #3B52B4",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const stepTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text-primary)",
  margin: "0 0 6px",
};

const stepDesc: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  margin: "0 0 20px",
  lineHeight: 1.6,
};

const emptyCard: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "40px 24px",
  textAlign: "center",
};

const btnPrimary: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px",
  background: "linear-gradient(135deg, #3B52B4, #5B73D4)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(59,82,180,0.25)",
};

const btnSecondary: React.CSSProperties = {
  padding: "14px 20px",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const btnDisabled: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px",
  background: "var(--bg-elevated)",
  color: "var(--text-muted)",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "not-allowed",
};

const btnSuccess: React.CSSProperties = {
  display: "block",
  padding: "14px",
  background: "linear-gradient(135deg, #059669, #10B981)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
};

const summaryChip: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-elevated)",
  borderRadius: 10,
  padding: "12px 8px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const chipNum: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const chipLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-muted)",
  fontWeight: 500,
};
