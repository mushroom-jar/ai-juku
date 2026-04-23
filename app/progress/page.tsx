"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import {
  AlertCircle, BookOpen, CheckCircle2, Clock, ExternalLink, Plus, Timer, Trash2, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type AssignmentStatus = "pending" | "submitted" | "late" | "graded";
type MainTab = "assignments" | "history";
type AssignFilter = "all" | "pending" | "submitted" | "graded";

type Assignment = {
  id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  submitted_at: string | null;
  status: AssignmentStatus;
  score: number | null;
  max_score: number | null;
  memo: string | null;
  created_at: string;
  book_id: string | null;
  books?: { id: string; title: string; subject: string; total_problems: number } | null;
};

type PracticeSession = {
  id: string;
  book_id: string | null;
  session_title: string | null;
  study_minutes: number;
  source: string;
  started_at: string | null;
  ended_at: string;
  result_summary: Array<{ label: string; attempts: (string | null)[] }> | null;
  books?: { title: string; subject: string } | null;
};

// ── Constants ──────────────────────────────────────────────────────
const SUBJECTS = [
  "math", "physics", "chemistry", "biology", "english", "japanese",
  "world_history", "japanese_history", "geography", "civics", "information", "other",
];

const SUBJECT_LABEL: Record<string, string> = {
  math: "数学", physics: "物理", chemistry: "化学", biology: "生物",
  english: "英語", japanese: "国語", world_history: "世界史",
  japanese_history: "日本史", geography: "地理", civics: "公民",
  information: "情報", other: "その他",
};

const SUBJECT_COLOR: Record<string, string> = {
  math: "#2563EB", physics: "#E11D48", chemistry: "#0891B2", biology: "#059669",
  english: "#7C3AED", japanese: "#D97706", world_history: "#B45309",
  japanese_history: "#A16207", geography: "#0F766E", civics: "#475569",
  information: "#4F46E5", other: "#64748B",
};

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: "未提出",   color: "#DC2626", bg: "#FEE2E2", icon: AlertCircle },
  submitted: { label: "提出済み", color: "#059669", bg: "#DCFCE7", icon: CheckCircle2 },
  late:      { label: "遅延提出", color: "#B45309", bg: "#FEF9C3", icon: Clock },
  graded:    { label: "評価済み", color: "#3157B7", bg: "#DBEAFE", icon: BookOpen },
};

// ── Helpers ────────────────────────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function pctColor(p: number) {
  if (p >= 80) return "#059669"; if (p >= 60) return "#3157B7"; if (p >= 40) return "#B45309"; return "#DC2626";
}
function pctBg(p: number) {
  if (p >= 80) return "#DCFCE7"; if (p >= 60) return "#DBEAFE"; if (p >= 40) return "#FEF9C3"; return "#FEE2E2";
}

// ── Main ──────────────────────────────────────────────────────────
export default function ProgressPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainTab>("assignments");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignStatus, setAssignStatus] = useState<AssignmentStatus>("pending");
  const [assignScore, setAssignScore] = useState("");
  const [assignMax, setAssignMax] = useState("");
  const [assignMemo, setAssignMemo] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/assignments").then(r => r.json()),
      fetch("/api/practice-sessions").then(r => r.json()),
    ]).then(([assignData, sessionsData]) => {
      setAssignments((assignData.assignments ?? []) as Assignment[]);
      setSessions((sessionsData.sessions ?? []) as PracticeSession[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pendingCount = assignments.filter(a => a.status === "pending").length;
  const overdueCount = assignments.filter(a => a.status === "pending" && isOverdue(a.due_date)).length;

  const thisMonth = new Date().getMonth();
  const thisYear  = new Date().getFullYear();
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.ended_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthMinutes = monthSessions.reduce((acc, s) => acc + s.study_minutes, 0);

  const filteredAssignments = useMemo(() => {
    if (assignFilter === "all") return assignments;
    if (assignFilter === "pending") return assignments.filter(a => a.status === "pending" || a.status === "late");
    if (assignFilter === "submitted") return assignments.filter(a => a.status === "submitted");
    return assignments.filter(a => a.status === "graded");
  }, [assignments, assignFilter]);

  const openAssignModal = () => {
    setAssignTitle(""); setAssignSubject(""); setAssignDue("");
    setAssignStatus("pending"); setAssignScore(""); setAssignMax(""); setAssignMemo("");
    setShowAssignModal(true);
  };

  const handleAddAssign = async () => {
    if (!assignTitle || savingAssign) return;
    setSavingAssign(true);
    const res = await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: assignTitle, subject: assignSubject || null, due_date: assignDue || null,
        status: assignStatus,
        score: assignScore !== "" ? Number(assignScore) : null,
        max_score: assignMax !== "" ? Number(assignMax) : null,
        memo: assignMemo || null,
      }),
    });
    const data = await res.json();
    if (data.assignment) setAssignments(prev => [data.assignment as Assignment, ...prev]);
    setSavingAssign(false); setShowAssignModal(false);
  };

  const handleStatusChange = async (id: string, status: AssignmentStatus) => {
    const patch: Partial<Assignment> = { status };
    if (status === "submitted" || status === "graded" || status === "late") {
      patch.submitted_at = new Date().toISOString();
    }
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.assignment) setAssignments(prev => prev.map(a => a.id === id ? data.assignment as Assignment : a));
  };

  const handleDeleteAssign = async (id: string) => {
    if (!confirm("この課題を削除しますか？")) return;
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 100px" }}>

        {/* ─ ヘッダー ─ */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={eyebrowStyle}>Study Log</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: "#0F172A" }}>課題・勉強履歴</h1>
          </div>
          <button onClick={openAssignModal} style={addBtnStyle}>
            <Plus size={14} /> 課題追加
          </button>
        </div>

        {/* ─ サマリーバー ─ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          <SummaryCard
            label="未提出課題"
            value={String(pendingCount)}
            color={overdueCount > 0 ? "#DC2626" : pendingCount > 0 ? "#B45309" : "#059669"}
            sub={overdueCount > 0 ? `うち${overdueCount}件が期限超過` : "全件期限内"}
          />
          <SummaryCard label="今月の勉強回数" value={String(monthSessions.length)} sub="練習セッション" color="#3157B7" />
          <SummaryCard label="今月の勉強時間" value={fmtDuration(monthMinutes)} sub="今月合計" color="#0F766E" />
        </div>

        {/* ─ タブ ─ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#F1F5F9", borderRadius: 12, padding: 4 }}>
          {([["assignments", "課題"], ["history", "勉強履歴"]] as [MainTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 800,
              background: tab === key ? "#fff" : "transparent",
              color: tab === key ? "#0F172A" : "#94A3B8",
              boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* ════ 課題タブ ════ */}
        {tab === "assignments" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {([["all", "すべて"], ["pending", "未提出"], ["submitted", "提出済み"], ["graded", "評価済み"]] as [AssignFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setAssignFilter(key)} style={{
                  padding: "6px 14px", borderRadius: 999, border: "1px solid",
                  borderColor: assignFilter === key ? "#059669" : "#E2E8F0",
                  background: assignFilter === key ? "#DCFCE7" : "#fff",
                  color: assignFilter === key ? "#059669" : "#64748B",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>{label}</button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", alignSelf: "center" }}>
                {filteredAssignments.length}件
              </span>
            </div>

            {filteredAssignments.length === 0 ? (
              <EmptyState message="課題がありません" sub="「課題追加」から登録してください" />
            ) : (
              <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {["状態", "課題名", "科目", "期限", "評価", "操作"].map((h, i) => (
                          <th key={i} style={{ ...thStyle, textAlign: i <= 2 ? "left" : "center" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.map((assign, idx) => {
                        const cfg = STATUS_CONFIG[assign.status];
                        const overdue = assign.status === "pending" && isOverdue(assign.due_date);
                        const scorePct = assign.score != null && assign.max_score != null
                          ? Math.round(assign.score / assign.max_score * 100) : null;

                        return (
                          <tr key={assign.id} style={{ borderBottom: idx < filteredAssignments.length - 1 ? "1px solid #F1F5F9" : "none", background: overdue ? "#FFFBEB" : "#fff" }}>
                            <td style={{ padding: "12px 14px" }}>
                              <select
                                value={assign.status}
                                onChange={e => void handleStatusChange(assign.id, e.target.value as AssignmentStatus)}
                                onClick={e => e.stopPropagation()}
                                style={{ padding: "4px 6px", borderRadius: 8, border: `1px solid ${cfg.color}30`, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 800, cursor: "pointer", outline: "none" }}
                              >
                                {(Object.keys(STATUS_CONFIG) as AssignmentStatus[]).map(s => (
                                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 800, color: "#0F172A", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {assign.title}
                                </span>
                                {assign.book_id && (
                                  <button
                                    onClick={() => router.push(`/materials/${assign.book_id}`)}
                                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: "1px solid #DBEAFE", background: "#EFF6FF", color: "#2563EB", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                    title="教材ページを開く"
                                  >
                                    <ExternalLink size={11} />
                                  </button>
                                )}
                              </div>
                              {assign.memo && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{assign.memo.slice(0, 40)}</div>}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              {assign.subject ? (
                                <span style={{ fontSize: 12, fontWeight: 700, color: SUBJECT_COLOR[assign.subject] ?? "#64748B" }}>
                                  {SUBJECT_LABEL[assign.subject] ?? assign.subject}
                                </span>
                              ) : <span style={{ color: "#E2E8F0" }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap" }}>
                              {assign.due_date ? (
                                <span style={{ color: overdue ? "#DC2626" : "#64748B", fontWeight: overdue ? 800 : 400 }}>
                                  {overdue && <AlertCircle size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />}
                                  {fmt(assign.due_date)}
                                </span>
                              ) : <span style={{ color: "#E2E8F0" }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "center" }}>
                              {assign.score != null && assign.max_score != null ? (
                                <div>
                                  <span style={{ fontWeight: 800, color: "#0F172A" }}>{assign.score}</span>
                                  <span style={{ color: "#CBD5E1" }}>/{assign.max_score}</span>
                                  {scorePct != null && <div style={{ marginTop: 2 }}><Badge bg={pctBg(scorePct)} color={pctColor(scorePct)}>{scorePct}%</Badge></div>}
                                </div>
                              ) : <span style={{ color: "#E2E8F0" }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "center" }}>
                              <IconBtn onClick={() => void handleDeleteAssign(assign.id)}><Trash2 size={12} /></IconBtn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════ 勉強履歴タブ ════ */}
        {tab === "history" && (
          sessions.length === 0 ? (
            <EmptyState message="勉強履歴がありません" sub="本棚から演習を記録するとここに表示されます" />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sessions.map(session => {
                const title = session.session_title ?? session.books?.title ?? "勉強セッション";
                const subject = session.books?.subject;
                const problemCount = session.result_summary?.length ?? 0;
                return (
                  <div key={session.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EFF6FF", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Timer size={18} color="#3157B7" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{fmt(session.ended_at)}</span>
                        {subject && <span style={{ color: SUBJECT_COLOR[subject] ?? "#64748B", fontWeight: 700 }}>{SUBJECT_LABEL[subject] ?? subject}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#3157B7" }}>{fmtDuration(session.study_minutes)}</div>
                      {problemCount > 0 && (
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{problemCount}問記録</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ════ 課題追加モーダル ════ */}
      {showAssignModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowAssignModal(false); }}>
          <div style={modalStyle}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <p style={eyebrowStyle}>Assignments</p>
                <h2 style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 900, color: "#0F172A" }}>課題を追加</h2>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={sectionLabel}>課題名</p>
              <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="例: 数学 問題集 p.34–36" style={hInputStyle} autoFocus />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <p style={sectionLabel}>科目 <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
                <select value={assignSubject} onChange={e => setAssignSubject(e.target.value)} style={hInputStyle}>
                  <option value="">選択してください</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{SUBJECT_LABEL[s] ?? s}</option>)}
                </select>
              </div>
              <div>
                <p style={sectionLabel}>提出期限 <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
                <input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} style={hInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={sectionLabel}>状態</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(STATUS_CONFIG) as AssignmentStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button key={s} onClick={() => setAssignStatus(s)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid",
                      borderColor: assignStatus === s ? cfg.color : "#E2E8F0",
                      background: assignStatus === s ? cfg.bg : "#fff",
                      color: assignStatus === s ? cfg.color : "#94A3B8",
                      fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}>{cfg.label}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <p style={sectionLabel}>得点 <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
                <input type="number" value={assignScore} onChange={e => setAssignScore(e.target.value)} placeholder="85" style={hInputStyle} />
              </div>
              <div>
                <p style={sectionLabel}>満点 <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
                <input type="number" value={assignMax} onChange={e => setAssignMax(e.target.value)} placeholder="100" style={hInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={sectionLabel}>メモ <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
              <input value={assignMemo} onChange={e => setAssignMemo(e.target.value)} placeholder="提出方法、注意点など" style={hInputStyle} />
            </div>

            <button onClick={() => void handleAddAssign()} disabled={!assignTitle || savingAssign} style={submitBtnStyle(!assignTitle)}>
              {savingAssign ? "追加中..." : "追加する"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────
function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -1 }}>{value}</div>
      {sub && <div style={summarySubStyle}>{sub}</div>}
    </div>
  );
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: bg, color }}>
      {children}
    </span>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#CBD5E1", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
      {children}
    </button>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div style={{ ...cardStyle, padding: "48px 0", textAlign: "center", color: "#94A3B8" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{message}</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>{sub}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const summaryCardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const summaryLabelStyle: CSSProperties = { fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
const summarySubStyle: CSSProperties = { fontSize: 10, color: "#94A3B8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" };
const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" };
const spinnerStyle: CSSProperties = { width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3157B7", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const modalStyle: CSSProperties = { width: "100%", maxWidth: 540, background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(15,23,42,0.18)" };
const closeBtnStyle: CSSProperties = { width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const hInputStyle: CSSProperties = { width: "100%", padding: "12px 14px", border: "1px solid #E8E8E4", borderRadius: 14, fontSize: 14, color: "#0F172A", outline: "none", background: "#FAFAFA", boxSizing: "border-box" };
const sectionLabel: CSSProperties = { margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#374151" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap", textAlign: "center" };
const submitBtnStyle = (disabled: boolean): CSSProperties => ({ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: disabled ? "#E2E8F0" : "linear-gradient(135deg,#2563EB,#3B52B4)", color: disabled ? "#94A3B8" : "#fff", fontSize: 15, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer" });
