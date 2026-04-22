"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import {
  Plus, Trash2, X, TrendingUp, TrendingDown, Minus,
  CheckCircle2, Clock, AlertCircle, BookOpen, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type ExamType = "mock" | "periodic" | "quiz";
type AssignmentStatus = "pending" | "submitted" | "late" | "graded";

type ExamScore = { score: number; max: number; deviation?: number };
type MockExam = {
  id: string;
  exam_name: string;
  exam_date: string;
  exam_type: ExamType;
  scores: Record<string, ExamScore>;
  total_score: number | null;
  total_max: number | null;
  total_deviation: number | null;
  memo: string | null;
};

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

type FormScores = Record<string, { score: string; max: string; deviation: string }>;
type MainTab = "tests" | "assignments" | "analysis";
type TestFilter = "all" | "mock" | "periodic" | "quiz";
type AssignFilter = "all" | "pending" | "submitted" | "graded";

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

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  mock: "模試", periodic: "定期テスト", quiz: "小テスト",
};
const EXAM_TYPE_COLOR: Record<ExamType, string> = {
  mock: "#3157B7", periodic: "#059669", quiz: "#B45309",
};
const EXAM_TYPE_BG: Record<ExamType, string> = {
  mock: "#DBEAFE", periodic: "#DCFCE7", quiz: "#FEF9C3",
};

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: "未提出",   color: "#DC2626", bg: "#FEE2E2", icon: AlertCircle },
  submitted: { label: "提出済み", color: "#059669", bg: "#DCFCE7", icon: CheckCircle2 },
  late:      { label: "遅延提出", color: "#B45309", bg: "#FEF9C3", icon: Clock },
  graded:    { label: "評価済み", color: "#3157B7", bg: "#DBEAFE", icon: BookOpen },
};

const COMMON_EXAMS = ["全統記述模試", "全統共通テスト模試", "駿台全国模試", "進研模試", "学校定期テスト"];

function initFormScores(): FormScores {
  return Object.fromEntries(SUBJECTS.map(s => [s, { score: "", max: "", deviation: "" }]));
}

// ── Helpers ────────────────────────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function short(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function devColor(v: number) {
  if (v >= 65) return "#059669"; if (v >= 55) return "#3157B7"; if (v >= 45) return "#B45309"; return "#DC2626";
}
function devBg(v: number) {
  if (v >= 65) return "#DCFCE7"; if (v >= 55) return "#DBEAFE"; if (v >= 45) return "#FEF9C3"; return "#FEE2E2";
}
function pctColor(p: number) {
  if (p >= 80) return "#059669"; if (p >= 60) return "#3157B7"; if (p >= 40) return "#B45309"; return "#DC2626";
}
function pctBg(p: number) {
  if (p >= 80) return "#DCFCE7"; if (p >= 60) return "#DBEAFE"; if (p >= 40) return "#FEF9C3"; return "#FEE2E2";
}
function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

// ── Main ──────────────────────────────────────────────────────────
export default function ProgressPage() {
  const router = useRouter();
  const [exams, setExams] = useState<MockExam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainTab>("tests");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Exam modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [examType, setExamType] = useState<ExamType>("mock");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalScore, setTotalScore] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [totalDev, setTotalDev] = useState("");
  const [examMemo, setExamMemo] = useState("");
  const [formScores, setFormScores] = useState<FormScores>(initFormScores());
  const [savingExam, setSavingExam] = useState(false);

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
      fetch("/api/mock-exams").then(r => r.json()),
      fetch("/api/assignments").then(r => r.json()),
    ]).then(([examsData, assignData]) => {
      setExams((examsData.exams ?? []) as MockExam[]);
      setAssignments((assignData.assignments ?? []) as Assignment[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Derived stats ─────────────────────────────────────────────
  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime()),
    [exams]
  );
  const mockExams = useMemo(() => sortedExams.filter(e => e.exam_type === "mock"), [sortedExams]);
  const devValues = mockExams.map(e => e.total_deviation != null ? Number(e.total_deviation) : null).filter((v): v is number => v != null);
  const latestDev = devValues[0] ?? null;
  const prevDev   = devValues[1] ?? null;
  const devDiff   = latestDev != null && prevDev != null ? latestDev - prevDev : null;
  const avgDev    = devValues.length ? devValues.reduce((a, b) => a + b, 0) / devValues.length : null;
  const bestDev   = devValues.length ? Math.max(...devValues) : null;

  const pendingCount = assignments.filter(a => a.status === "pending").length;
  const overdueCount = assignments.filter(a => a.status === "pending" && isOverdue(a.due_date)).length;

  const filteredExams = useMemo(() =>
    testFilter === "all" ? sortedExams : sortedExams.filter(e => e.exam_type === testFilter),
    [sortedExams, testFilter]
  );

  const filteredAssignments = useMemo(() => {
    if (assignFilter === "all") return assignments;
    if (assignFilter === "pending") return assignments.filter(a => a.status === "pending" || a.status === "late");
    if (assignFilter === "submitted") return assignments.filter(a => a.status === "submitted");
    return assignments.filter(a => a.status === "graded");
  }, [assignments, assignFilter]);

  const allSubjects = useMemo(
    () => Array.from(new Set(exams.flatMap(e => Object.keys(e.scores ?? {})))),
    [exams]
  );

  const subjectStats = useMemo(() => {
    const stats: Record<string, { totalPct: number; count: number; devTotal: number; devCount: number }> = {};
    for (const exam of exams) {
      for (const [subj, val] of Object.entries(exam.scores ?? {})) {
        if (!val?.max) continue;
        if (!stats[subj]) stats[subj] = { totalPct: 0, count: 0, devTotal: 0, devCount: 0 };
        stats[subj].totalPct += val.score / val.max;
        stats[subj].count++;
        if (val.deviation != null) { stats[subj].devTotal += val.deviation; stats[subj].devCount++; }
      }
    }
    return Object.entries(stats).map(([subj, v]) => ({
      subj, pct: Math.round(v.totalPct / v.count * 100),
      avgDev: v.devCount ? v.devTotal / v.devCount : null, count: v.count,
    })).sort((a, b) => b.pct - a.pct);
  }, [exams]);

  // ── Exam handlers ─────────────────────────────────────────────
  const openExamModal = (type: ExamType = "mock") => {
    setExamType(type); setExamName(""); setExamDate(new Date().toISOString().slice(0, 10));
    setTotalScore(""); setTotalMax(""); setTotalDev(""); setExamMemo("");
    setFormScores(initFormScores()); setShowExamModal(true);
  };

  const handleAddExam = async () => {
    if (!examName || !examDate || savingExam) return;
    setSavingExam(true);
    const scores: Record<string, ExamScore> = {};
    for (const s of SUBJECTS) {
      const row = formScores[s];
      if (row.score !== "" && row.max !== "") {
        scores[s] = { score: Number(row.score), max: Number(row.max), ...(row.deviation !== "" ? { deviation: Number(row.deviation) } : {}) };
      }
    }
    const res = await fetch("/api/mock-exams", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_name: examName, exam_date: examDate, exam_type: examType, scores,
        total_score: totalScore !== "" ? Number(totalScore) : null,
        total_max: totalMax !== "" ? Number(totalMax) : null,
        total_deviation: totalDev !== "" ? Number(totalDev) : null,
        memo: examMemo || null }),
    });
    const data = await res.json();
    if (data.exam) setExams(prev => [data.exam as MockExam, ...prev]);
    setSavingExam(false); setShowExamModal(false);
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    await fetch(`/api/mock-exams/${id}`, { method: "DELETE" });
    setExams(prev => prev.filter(e => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // ── Assignment handlers ───────────────────────────────────────
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
            <p style={eyebrowStyle}>Score Board</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: "#0F172A" }}>成績管理</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openExamModal("mock")} style={addBtnStyle}>
              <Plus size={14} /> テスト記録
            </button>
            <button onClick={openAssignModal} style={{ ...addBtnStyle, background: "#059669" }}>
              <Plus size={14} /> 課題追加
            </button>
          </div>
        </div>

        {/* ─ サマリーバー ─ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          <SummaryCard label="直近偏差値（模試）" value={latestDev != null ? latestDev.toFixed(1) : "—"} color={latestDev != null ? devColor(latestDev) : "#CBD5E1"} diff={devDiff} sub={mockExams[0]?.exam_name ?? ""} />
          <SummaryCard label="平均偏差値" value={avgDev != null ? avgDev.toFixed(1) : "—"} color={avgDev != null ? devColor(avgDev) : "#CBD5E1"} sub={`${devValues.length}回分`} />
          <SummaryCard label="自己ベスト" value={bestDev != null ? bestDev.toFixed(1) : "—"} color={bestDev != null ? devColor(bestDev) : "#CBD5E1"} sub="偏差値最高値" />
          <SummaryCard
            label="未提出課題"
            value={String(pendingCount)}
            color={overdueCount > 0 ? "#DC2626" : pendingCount > 0 ? "#B45309" : "#059669"}
            sub={overdueCount > 0 ? `うち${overdueCount}件が期限超過` : "全件期限内"}
          />
        </div>

        {/* ─ タブ ─ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#F1F5F9", borderRadius: 12, padding: 4 }}>
          {([["tests", "テスト・模試"], ["assignments", "課題"], ["analysis", "成績分析"]] as [MainTab, string][]).map(([key, label]) => (
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

        {/* ════ テスト・模試タブ ════ */}
        {tab === "tests" && (
          <>
            {/* サブフィルター */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {([["all", "すべて"], ["mock", "模試"], ["periodic", "定期テスト"], ["quiz", "小テスト"]] as [TestFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTestFilter(key)} style={{
                  padding: "6px 14px", borderRadius: 999, border: "1px solid",
                  borderColor: testFilter === key ? "#3157B7" : "#E2E8F0",
                  background: testFilter === key ? "#DBEAFE" : "#fff",
                  color: testFilter === key ? "#1D4ED8" : "#64748B",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>{label}</button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", alignSelf: "center" }}>
                {filteredExams.length}件
              </span>
            </div>

            {filteredExams.length === 0 ? (
              <EmptyState message="記録がありません" sub="「テスト記録」から追加してください" />
            ) : (
              <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {["種別", "試験名", "日付", "得点 / 満点", "得点率", "偏差値", ""].map((h, i) => (
                          <th key={i} style={{ ...thStyle, textAlign: i <= 1 ? "left" : "center" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExams.map((exam, idx) => {
                        const pct = exam.total_score != null && exam.total_max != null
                          ? Math.round(exam.total_score / exam.total_max * 100) : null;
                        const isExp = expandedId === exam.id;
                        const subEntries = Object.entries(exam.scores ?? {});
                        const et = (exam.exam_type ?? "mock") as ExamType;

                        return (
                          <>
                            <tr
                              key={exam.id}
                              onClick={() => setExpandedId(isExp ? null : exam.id)}
                              style={{ cursor: "pointer", background: isExp ? "#FAFCFF" : "#fff", borderBottom: isExp || idx === filteredExams.length - 1 ? "none" : "1px solid #F1F5F9" }}
                            >
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: EXAM_TYPE_BG[et], color: EXAM_TYPE_COLOR[et] }}>
                                  {EXAM_TYPE_LABEL[et]}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: 800, color: "#0F172A", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exam.exam_name}</div>
                                {exam.memo && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{exam.memo.slice(0, 30)}</div>}
                              </td>
                              <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748B", fontSize: 13, whiteSpace: "nowrap" }}>{fmt(exam.exam_date)}</td>
                              <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                                {exam.total_score != null && exam.total_max != null
                                  ? <>{exam.total_score}<span style={{ color: "#CBD5E1", fontWeight: 400 }}>/{exam.total_max}</span></>
                                  : <span style={{ color: "#E2E8F0" }}>—</span>}
                              </td>
                              <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                {pct != null
                                  ? <Badge bg={pctBg(pct)} color={pctColor(pct)}>{pct}%</Badge>
                                  : <span style={{ color: "#E2E8F0" }}>—</span>}
                              </td>
                              <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                {exam.total_deviation != null
                                  ? <Badge bg={devBg(Number(exam.total_deviation))} color={devColor(Number(exam.total_deviation))} large>{Number(exam.total_deviation).toFixed(1)}</Badge>
                                  : <span style={{ color: "#E2E8F0" }}>—</span>}
                              </td>
                              <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                <IconBtn onClick={e => { e.stopPropagation(); void handleDeleteExam(exam.id); }}><Trash2 size={12} /></IconBtn>
                              </td>
                            </tr>
                            {isExp && subEntries.length > 0 && (
                              <tr key={`${exam.id}-sub`} style={{ borderBottom: idx < filteredExams.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                                <td colSpan={7} style={{ padding: "0 14px 14px 40px", background: "#FAFCFF" }}>
                                  <table style={{ ...tableStyle, fontSize: 12 }}>
                                    <thead>
                                      <tr>
                                        {["科目", "得点", "満点", "得点率", "偏差値"].map((h, i) => (
                                          <th key={i} style={{ ...thStyle, fontSize: 10, textAlign: i === 0 ? "left" : "center", background: "transparent" }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subEntries.map(([subj, val], si) => {
                                        const sp = Math.round(val.score / val.max * 100);
                                        return (
                                          <tr key={subj} style={{ borderBottom: si < subEntries.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                                            <td style={{ padding: "7px 10px", fontWeight: 700, color: SUBJECT_COLOR[subj] ?? "#64748B" }}>{SUBJECT_LABEL[subj] ?? subj}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#0F172A" }}>{val.score}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center", color: "#94A3B8" }}>{val.max}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center" }}><Badge bg={pctBg(sp)} color={pctColor(sp)}>{sp}%</Badge></td>
                                            <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                              {val.deviation != null
                                                ? <span style={{ fontWeight: 800, color: devColor(val.deviation) }}>{val.deviation.toFixed(1)}</span>
                                                : <span style={{ color: "#E2E8F0" }}>—</span>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

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
                        const Icon = cfg.icon;
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

        {/* ════ 分析タブ ════ */}
        {tab === "analysis" && (
          <div style={{ display: "grid", gap: 16 }}>

            {/* 偏差値推移 */}
            {devValues.length >= 2 && (
              <div style={cardStyle}>
                <div style={{ ...cardTitleStyle, marginBottom: 14 }}>模試 偏差値の推移</div>
                <TrendChart exams={mockExams.filter(e => e.total_deviation != null).reverse()} />
              </div>
            )}

            {exams.length === 0 ? (
              <EmptyState message="データがありません" sub="テスト記録を追加すると分析が表示されます" />
            ) : (
              <>
                {/* 科目×試験クロス集計 */}
                {allSubjects.length > 0 && (
                  <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={cardTitleStyle}>科目別スコア一覧</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>各試験の得点率（偏差値）— 古い順</div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ ...tableStyle, fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC" }}>
                            <th style={{ ...thStyle, textAlign: "left", minWidth: 72 }}>科目</th>
                            {[...exams].reverse().map(e => (
                              <th key={e.id} style={{ ...thStyle, minWidth: 66 }}>
                                <div style={{ fontWeight: 800, color: "#0F172A" }}>{short(e.exam_date)}</div>
                                <div style={{ fontSize: 9, color: "#94A3B8", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {e.exam_name.slice(0, 6)}
                                </div>
                              </th>
                            ))}
                            <th style={{ ...thStyle, minWidth: 60 }}>平均</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* 総合行 */}
                          <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                            <td style={{ padding: "9px 14px", fontWeight: 800, color: "#0F172A", fontSize: 12 }}>総合</td>
                            {[...exams].reverse().map(e => {
                              const p = e.total_score != null && e.total_max != null
                                ? Math.round(e.total_score / e.total_max * 100) : null;
                              return (
                                <td key={e.id} style={{ padding: "7px 6px", textAlign: "center" }}>
                                  {p != null ? (
                                    <>
                                      <Badge bg={pctBg(p)} color={pctColor(p)}>{p}%</Badge>
                                      {e.total_deviation != null && (
                                        <div style={{ fontSize: 10, fontWeight: 800, color: devColor(Number(e.total_deviation)), marginTop: 2 }}>
                                          偏{Number(e.total_deviation).toFixed(1)}
                                        </div>
                                      )}
                                    </>
                                  ) : <span style={{ color: "#E2E8F0" }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ padding: "7px 6px", textAlign: "center" }}>
                              {avgDev != null && <span style={{ fontWeight: 800, color: devColor(avgDev) }}>偏{avgDev.toFixed(1)}</span>}
                            </td>
                          </tr>
                          {/* 科目行 */}
                          {allSubjects.map((subj, si) => {
                            const stat = subjectStats.find(s => s.subj === subj);
                            return (
                              <tr key={subj} style={{ borderBottom: si < allSubjects.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                                <td style={{ padding: "9px 14px", fontWeight: 700, color: SUBJECT_COLOR[subj] ?? "#64748B", whiteSpace: "nowrap" }}>
                                  {SUBJECT_LABEL[subj] ?? subj}
                                </td>
                                {[...exams].reverse().map(e => {
                                  const val = e.scores?.[subj];
                                  if (!val) return <td key={e.id} style={{ padding: "7px 6px", textAlign: "center", color: "#E2E8F0" }}>—</td>;
                                  const p = Math.round(val.score / val.max * 100);
                                  return (
                                    <td key={e.id} style={{ padding: "7px 6px", textAlign: "center" }}>
                                      <Badge bg={pctBg(p)} color={pctColor(p)}>{p}%</Badge>
                                      {val.deviation != null && (
                                        <div style={{ fontSize: 10, fontWeight: 700, color: devColor(val.deviation), marginTop: 2 }}>偏{val.deviation.toFixed(1)}</div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: "7px 6px", textAlign: "center" }}>
                                  {stat && <Badge bg={pctBg(stat.pct)} color={pctColor(stat.pct)}>{stat.pct}%</Badge>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Legend />
                  </div>
                )}

                {/* 科目別平均バー */}
                {subjectStats.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{ ...cardTitleStyle, marginBottom: 14 }}>科目別 平均得点率</div>
                    {subjectStats.map(({ subj, pct, avgDev: ad, count }) => (
                      <div key={subj} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 62, fontSize: 11, fontWeight: 700, color: SUBJECT_COLOR[subj] ?? "#64748B", textAlign: "right", flexShrink: 0 }}>
                          {SUBJECT_LABEL[subj] ?? subj}
                        </div>
                        <div style={{ flex: 1, height: 18, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pctColor(pct), borderRadius: 999, transition: "width 0.5s ease" }} />
                        </div>
                        <div style={{ width: 36, fontSize: 12, fontWeight: 800, color: pctColor(pct), textAlign: "right", flexShrink: 0 }}>{pct}%</div>
                        {ad != null && <div style={{ width: 56, fontSize: 11, fontWeight: 700, color: devColor(ad), textAlign: "right", flexShrink: 0 }}>偏{ad.toFixed(1)}</div>}
                        <div style={{ width: 26, fontSize: 10, color: "#CBD5E1", textAlign: "right", flexShrink: 0 }}>{count}回</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ════ テスト記録モーダル ════ */}
      {showExamModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowExamModal(false); }}>
          <div style={modalStyle}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <p style={eyebrowStyle}>Score Board</p>
                <h2 style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 900, color: "#0F172A" }}>テスト・模試を記録</h2>
              </div>
              <button onClick={() => setShowExamModal(false)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            {/* 種別選択 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {(["mock", "periodic", "quiz"] as ExamType[]).map(t => (
                <button key={t} onClick={() => setExamType(t)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 12, border: "1.5px solid",
                  borderColor: examType === t ? EXAM_TYPE_COLOR[t] : "#E2E8F0",
                  background: examType === t ? EXAM_TYPE_BG[t] : "#fff",
                  color: examType === t ? EXAM_TYPE_COLOR[t] : "#94A3B8",
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}>{EXAM_TYPE_LABEL[t]}</button>
              ))}
            </div>

            {/* 試験名 */}
            <div style={{ marginBottom: 12 }}>
              <input list="exam-sugg" value={examName} onChange={e => setExamName(e.target.value)} placeholder="試験名を入力" style={hInputStyle} autoFocus />
              <datalist id="exam-sugg">{COMMON_EXAMS.map(n => <option key={n} value={n} />)}</datalist>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {COMMON_EXAMS.map(n => (
                <button key={n} onClick={() => setExamName(n)} style={{ ...pillBtnStyle, ...(examName === n ? pillActiveStyle : {}) }}>{n}</button>
              ))}
            </div>

            {/* 受験日 */}
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>受験日</p>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={hInputStyle} />
            </div>

            {/* 合計スコア */}
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>合計スコア <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "得点", value: totalScore, set: setTotalScore, ph: "170" },
                  { label: "満点", value: totalMax, set: setTotalMax, ph: "200" },
                  { label: "偏差値", value: totalDev, set: setTotalDev, ph: "62.5" },
                ].map(({ label, value, set, ph }) => (
                  <div key={label}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>{label}</span>
                    <input type="number" step={label === "偏差値" ? "0.1" : "1"} value={value} onChange={e => set(e.target.value)} placeholder={ph} style={{ ...hInputStyle, textAlign: "center" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* 科目別スコア */}
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>科目別スコア <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
              <div style={{ border: "1px solid #E8E8E4", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr 1fr", background: "#F8FAFC", borderBottom: "1px solid #E8E8E4" }}>
                  {["科目", "得点", "満点", "偏差値"].map((h, i) => (
                    <div key={i} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 800, color: "#94A3B8", textAlign: i > 0 ? "center" : "left", textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {SUBJECTS.map((s, idx) => (
                    <div key={s} style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr 1fr", borderBottom: idx < SUBJECTS.length - 1 ? "1px solid #F1F5F9" : "none", alignItems: "center" }}>
                      <div style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, color: SUBJECT_COLOR[s] ?? "#64748B" }}>{SUBJECT_LABEL[s] ?? s}</div>
                      {(["score", "max", "deviation"] as const).map(field => (
                        <div key={field} style={{ padding: "3px 5px" }}>
                          <input type="number" step={field === "deviation" ? "0.1" : "1"} placeholder="—" value={formScores[s][field]} onChange={e => setFormScores(p => ({ ...p, [s]: { ...p[s], [field]: e.target.value } }))} style={{ width: "100%", padding: "6px 4px", border: "1px solid #E8E8E4", borderRadius: 8, fontSize: 12, color: "#0F172A", outline: "none", background: "#fff", textAlign: "center", boxSizing: "border-box" }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* メモ */}
            <div style={{ marginBottom: 20 }}>
              <p style={sectionLabel}>メモ <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>（任意）</span></p>
              <input value={examMemo} onChange={e => setExamMemo(e.target.value)} placeholder="気づいた点、次回の目標など" style={hInputStyle} />
            </div>

            <button onClick={() => void handleAddExam()} disabled={!examName || !examDate || savingExam} style={submitBtnStyle(!examName || !examDate)}>
              {savingExam ? "保存中..." : "記録する"}
            </button>
          </div>
        </div>
      )}

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
function SummaryCard({ label, value, color, diff, sub }: { label: string; value: string; color: string; diff?: number | null; sub?: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -1 }}>{value}</span>
        {diff != null && (
          <span style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 1, color: diff > 0 ? "#059669" : diff < 0 ? "#DC2626" : "#94A3B8" }}>
            {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(diff).toFixed(1)}
          </span>
        )}
      </div>
      {sub && <div style={summarySubStyle}>{sub}</div>}
    </div>
  );
}

function Badge({ bg, color, children, large }: { bg: string; color: string; children: React.ReactNode; large?: boolean }) {
  return (
    <span style={{ display: "inline-block", padding: large ? "3px 11px" : "2px 8px", borderRadius: 999, fontSize: large ? 13 : 11, fontWeight: 800, background: bg, color }}>
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

function Legend() {
  return (
    <div style={{ padding: "10px 16px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 14, flexWrap: "wrap" }}>
      {[{ label: "80%+", bg: "#DCFCE7", fg: "#059669" }, { label: "60–79%", bg: "#DBEAFE", fg: "#3157B7" }, { label: "40–59%", bg: "#FEF9C3", fg: "#B45309" }, { label: "40%未満", bg: "#FEE2E2", fg: "#DC2626" }].map(({ label, bg, fg }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, display: "inline-block" }} />
          <span style={{ color: fg }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

function TrendChart({ exams }: { exams: MockExam[] }) {
  if (exams.length < 2) return null;
  const W = 680, H = 120, PX = 40, PY = 16;
  const IW = W - PX * 2, IH = H - PY * 2;
  const devs = exams.map(e => Number(e.total_deviation));
  const maxD = Math.max(...devs, 70), minD = Math.min(...devs, 40);
  const range = maxD - minD || 1;
  const toY = (d: number) => PY + (1 - (d - minD) / range) * IH;
  const toX = (i: number) => exams.length === 1 ? W / 2 : PX + (i / (exams.length - 1)) * IW;
  const pts = exams.map((e, i) => ({ x: toX(i), y: toY(Number(e.total_deviation)), e }));
  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `M${pts[0].x},${H - PY} ${pts.map(p => `L${p.x},${p.y}`).join(" ")} L${pts[pts.length - 1].x},${H - PY} Z`;
  const g60 = toY(60);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {g60 > PY && g60 < H - PY && (
        <>
          <line x1={PX} y1={g60} x2={W - PX} y2={g60} stroke="#C7D2FE" strokeWidth={1} strokeDasharray="4 3" />
          <text x={PX - 4} y={g60 + 4} textAnchor="end" fontSize={9} fill="#A5B4FC">60</text>
        </>
      )}
      <path d={area} fill="#3157B715" />
      <polyline points={line} fill="none" stroke="#3157B7" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#3157B7" strokeWidth={2.5} />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fontWeight="800" fill={devColor(Number(p.e.total_deviation))}>
            {Number(p.e.total_deviation).toFixed(1)}
          </text>
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize={9} fill="#94A3B8">{short(p.e.exam_date)}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const cardTitleStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0F172A" };
const summaryCardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const summaryLabelStyle: CSSProperties = { fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
const summarySubStyle: CSSProperties = { fontSize: 10, color: "#94A3B8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#3157B7", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" };
const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" };
const spinnerStyle: CSSProperties = { width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3157B7", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const modalStyle: CSSProperties = { width: "100%", maxWidth: 540, background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(15,23,42,0.18)" };
const closeBtnStyle: CSSProperties = { width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const hInputStyle: CSSProperties = { width: "100%", padding: "12px 14px", border: "1px solid #E8E8E4", borderRadius: 14, fontSize: 14, color: "#0F172A", outline: "none", background: "#FAFAFA", boxSizing: "border-box" };
const pillBtnStyle: CSSProperties = { padding: "5px 10px", borderRadius: 20, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 11, fontWeight: 700, cursor: "pointer" };
const pillActiveStyle: CSSProperties = { borderColor: "rgba(37,99,235,0.35)", background: "#EEF4FF", color: "#2563EB" };
const sectionLabel: CSSProperties = { margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#374151" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap", textAlign: "center" };
const submitBtnStyle = (disabled: boolean): CSSProperties => ({ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: disabled ? "#E2E8F0" : "linear-gradient(135deg,#2563EB,#3B52B4)", color: disabled ? "#94A3B8" : "#fff", fontSize: 15, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer" });
