"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import {
  Activity, Brain, CalendarDays, Clock3, Flame, GraduationCap, MessageSquareText,
  Minus, Plus, Trash2, TrendingDown, TrendingUp, X,
} from "lucide-react";

// ── 振り返りデータ型 ─────────────────────────────────────────────
type ReflectionData = {
  student: { name: string; targetUniv: string | null; examDate: string | null; xp: number };
  overview: {
    totalStudyMinutes: number; thisWeekStudyMinutes: number; thisMonthStudyMinutes: number;
    totalSolved: number; monthlySolved: number; totalQuestions: number; monthlyQuestions: number; completedTasks: number;
  };
  continuity: { currentStreak: number; longestStreak: number; activeDays: number; unlockedBadgeIds: string[] };
  weeklyTrend: Array<{ week: string; studyMinutes: number; solved: number; perfect: number; wrong: number; questions: number }>;
  exams: {
    latest: { id: string; exam_name: string; exam_date: string; total_score: number | null; total_max: number | null; total_deviation: number | null } | null;
    recent: Array<{ id: string; exam_name: string; exam_date: string; total_score: number | null; total_max: number | null; total_deviation: number | null }>;
    count: number; deviationChange: number | null;
  };
};

// ── 成績管理型 ────────────────────────────────────────────────────
type ExamType = "mock" | "periodic" | "quiz";
type ExamScore = { score: number; max: number; deviation?: number };
type MockExam = {
  id: string; exam_name: string; exam_date: string; exam_type: ExamType;
  scores: Record<string, ExamScore>;
  total_score: number | null; total_max: number | null; total_deviation: number | null; memo: string | null;
};
type FormScores = Record<string, { score: string; max: string; deviation: string }>;
type TestFilter = "all" | "mock" | "periodic" | "quiz";
type ScoreTab = "list" | "analysis";

// ── 定数 ─────────────────────────────────────────────────────────
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
const EXAM_TYPE_LABEL: Record<ExamType, string> = { mock: "模試", periodic: "定期テスト", quiz: "小テスト" };
const EXAM_TYPE_COLOR: Record<ExamType, string> = { mock: "#3157B7", periodic: "#059669", quiz: "#B45309" };
const EXAM_TYPE_BG: Record<ExamType, string> = { mock: "#DBEAFE", periodic: "#DCFCE7", quiz: "#FEF9C3" };
const COMMON_EXAMS = ["全統記述模試", "全統共通テスト模試", "駿台全国模試", "進研模試", "学校定期テスト"];

function initFormScores(): FormScores {
  return Object.fromEntries(SUBJECTS.map(s => [s, { score: "", max: "", deviation: "" }]));
}

// ── ヘルパー ─────────────────────────────────────────────────────
function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function short(iso: string) { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; }
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
function formatStudyMinutes(totalMinutes: number) {
  if (!totalMinutes || totalMinutes <= 0) return "0分";
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ── メインコンポーネント ─────────────────────────────────────────
export default function ReflectionPage() {
  const [data, setData] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<"reflection" | "scores">("reflection");

  // 成績記録用state
  const [exams, setExams] = useState<MockExam[]>([]);
  const [examsLoaded, setExamsLoaded] = useState(false);
  const [scoreTab, setScoreTab] = useState<ScoreTab>("list");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 模試追加モーダル
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

  useEffect(() => {
    fetch("/api/reflection", { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setData(json); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (mainTab === "scores" && !examsLoaded) {
      fetch("/api/mock-exams").then(r => r.json()).then(d => {
        setExams((d.exams ?? []) as MockExam[]);
        setExamsLoaded(true);
      }).catch(() => {});
    }
  }, [mainTab, examsLoaded]);

  const weeklyAverage = useMemo(() => {
    if (!data || data.weeklyTrend.length === 0) return 0;
    return Math.round(data.weeklyTrend.reduce((sum, week) => sum + week.studyMinutes, 0) / data.weeklyTrend.length);
  }, [data]);

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

  const filteredExams = useMemo(() =>
    testFilter === "all" ? sortedExams : sortedExams.filter(e => e.exam_type === testFilter),
    [sortedExams, testFilter]
  );

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
      body: JSON.stringify({
        exam_name: examName, exam_date: examDate, exam_type: examType, scores,
        total_score: totalScore !== "" ? Number(totalScore) : null,
        total_max: totalMax !== "" ? Number(totalMax) : null,
        total_deviation: totalDev !== "" ? Number(totalDev) : null,
        memo: examMemo || null,
      }),
    });
    const d = await res.json();
    if (d.exam) setExams(prev => [d.exam as MockExam, ...prev]);
    setSavingExam(false); setShowExamModal(false);
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    await fetch(`/api/mock-exams/${id}`, { method: "DELETE" });
    setExams(prev => prev.filter(e => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}><div style={spinnerStyle} /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>

          {/* ─ ページタブ ─ */}
          <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 12, padding: 4, maxWidth: 340 }}>
            {([["reflection", "振り返り"], ["scores", "成績記録"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setMainTab(key)} style={{
                flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 800,
                background: mainTab === key ? "#fff" : "transparent",
                color: mainTab === key ? "#0F172A" : "#94A3B8",
                boxShadow: mainTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          {/* ════ 振り返りタブ ════ */}
          {mainTab === "reflection" && (
            <>
              {!data ? (
                <div style={emptyStyle}>振り返りデータを読み込めませんでした。</div>
              ) : (
                <>
                  <section style={heroStyle}>
                    <p style={eyebrowStyle}>Reflection</p>
                    <h1 style={titleStyle}>振り返る</h1>
                    <p style={subtitleStyle}>
                      勉強時間、問題数、質問、模試の流れをグラフでまとめて見返しながら、今の調子と次に整えたいポイントをつかめます。
                    </p>
                  </section>

                  <section style={statsGridStyle}>
                    <TopStatCard label="今週の勉強時間" value={formatStudyMinutes(data.overview.thisWeekStudyMinutes)} helper="今週どれだけ積み上げたか" icon={<Clock3 size={16} />} />
                    <TopStatCard label="今月の勉強時間" value={formatStudyMinutes(data.overview.thisMonthStudyMinutes)} helper="今月の学習ボリューム" icon={<CalendarDays size={16} />} />
                    <TopStatCard label="連続日数" value={`${data.continuity.currentStreak}日`} helper={`最長 ${data.continuity.longestStreak}日`} icon={<Flame size={16} />} />
                    <TopStatCard label="今月の質問" value={`${data.overview.monthlyQuestions}回`} helper={`累計 ${data.overview.totalQuestions}回`} icon={<MessageSquareText size={16} />} />
                  </section>

                  <section style={twoColStyle}>
                    <div style={cardStyle}>
                      <SectionHead icon={<TrendingUp size={16} color="#3157B7" />} title="勉強時間の推移" desc="週ごとの勉強時間を折れ線で見て、最近のリズムをつかみます。" />
                      <StudyTimeLineChart weeks={data.weeklyTrend} />
                    </div>
                    <div style={cardStyle}>
                      <SectionHead icon={<Activity size={16} color="#3157B7" />} title="問題・質問のバランス" desc="どれだけ解けていて、どれだけ質問しているかを同時に見返せます。" />
                      <SolvedQuestionsChart weeks={data.weeklyTrend} />
                    </div>
                  </section>

                  <section style={threeColStyle}>
                    <div style={cardStyle}>
                      <SectionHead icon={<Brain size={16} color="#3157B7" />} title="学習の内訳" desc="今の積み上がりを割合で見て、どこが強いかを一目で把握できます。" />
                      <SplitCharts solved={data.overview.totalSolved} questions={data.overview.totalQuestions} tasks={data.overview.completedTasks} studyMinutes={data.overview.totalStudyMinutes} />
                    </div>
                    <div style={cardStyle}>
                      <SectionHead icon={<GraduationCap size={16} color="#3157B7" />} title="模試の推移" desc="偏差値や点数の流れを見て、最近の成績の動きを確認できます。" />
                      <ExamTrendChart exams={data.exams.recent.slice().reverse()} />
                      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                        <InsightRow label="直近の模試" value={data.exams.latest ? data.exams.latest.exam_name : "未登録"} helper={data.exams.latest ? formatDate(data.exams.latest.exam_date) : "まずは模試を登録"} />
                        <InsightRow label="偏差値の変化" value={data.exams.deviationChange == null ? "-" : `${data.exams.deviationChange > 0 ? "+" : ""}${data.exams.deviationChange}`} helper="最初の模試からの変化" />
                      </div>
                    </div>
                    <div style={cardStyle}>
                      <SectionHead icon={<Activity size={16} color="#3157B7" />} title="今のひとこと" desc="最近の流れから、今の状態を短くまとめています。" />
                      <div style={summaryBoxStyle}>
                        <div style={summaryTitleStyle}>{buildSummaryTitle(data)}</div>
                        <div style={summaryBodyStyle}>{buildSummaryBody(data, weeklyAverage)}</div>
                      </div>
                      <div style={miniChartStackStyle}>
                        <MiniTrendCard label="週間平均" value={formatStudyMinutes(weeklyAverage)} accent="#3157B7" />
                        <MiniTrendCard label="累計の解いた問題" value={`${data.overview.totalSolved}問`} accent="#0F766E" />
                        <MiniTrendCard label="活動日数" value={`${data.continuity.activeDays}日`} accent="#7C3AED" />
                      </div>
                      <div style={ctaRowStyle}>
                        <Link href="/shelf" style={ctaStyle}>演習を始める</Link>
                        <Link href="/my-sensei" style={ghostCtaStyle}>My先生に相談</Link>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {/* ════ 成績記録タブ ════ */}
          {mainTab === "scores" && (
            <div style={{ maxWidth: 820 }}>

              {/* ヘッダー */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p style={eyebrowStyle}>Score Board</p>
                  <h2 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: "#0F172A" }}>成績記録</h2>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openExamModal("mock")} style={addBtnStyle}>
                    <Plus size={14} /> テスト記録
                  </button>
                </div>
              </div>

              {/* サマリーバー */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                <ScoreCard label="直近偏差値（模試）" value={latestDev != null ? latestDev.toFixed(1) : "—"} color={latestDev != null ? devColor(latestDev) : "#CBD5E1"} diff={devDiff} sub={mockExams[0]?.exam_name ?? ""} />
                <ScoreCard label="平均偏差値" value={avgDev != null ? avgDev.toFixed(1) : "—"} color={avgDev != null ? devColor(avgDev) : "#CBD5E1"} sub={`${devValues.length}回分`} />
                <ScoreCard label="自己ベスト" value={bestDev != null ? bestDev.toFixed(1) : "—"} color={bestDev != null ? devColor(bestDev) : "#CBD5E1"} sub="偏差値最高値" />
                <ScoreCard label="登録件数" value={String(exams.length)} color="#3157B7" sub="全テスト" />
              </div>

              {/* サブタブ */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#F1F5F9", borderRadius: 12, padding: 4 }}>
                {([["list", "テスト一覧"], ["analysis", "成績分析"]] as [ScoreTab, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setScoreTab(key)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 800,
                    background: scoreTab === key ? "#fff" : "transparent",
                    color: scoreTab === key ? "#0F172A" : "#94A3B8",
                    boxShadow: scoreTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}>{label}</button>
                ))}
              </div>

              {/* テスト一覧 */}
              {scoreTab === "list" && (
                <>
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
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", alignSelf: "center" }}>{filteredExams.length}件</span>
                  </div>

                  {!examsLoaded ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><div style={spinnerStyle2} /></div>
                  ) : filteredExams.length === 0 ? (
                    <ScoreEmpty />
                  ) : (
                    <div style={{ ...scoreCardStyle, padding: 0, overflow: "hidden" }}>
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
                                <Fragment key={exam.id}>
                                  <tr
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
                                      {pct != null ? <SBadge bg={pctBg(pct)} color={pctColor(pct)}>{pct}%</SBadge> : <span style={{ color: "#E2E8F0" }}>—</span>}
                                    </td>
                                    <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                      {exam.total_deviation != null
                                        ? <SBadge bg={devBg(Number(exam.total_deviation))} color={devColor(Number(exam.total_deviation))} large>{Number(exam.total_deviation).toFixed(1)}</SBadge>
                                        : <span style={{ color: "#E2E8F0" }}>—</span>}
                                    </td>
                                    <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                      <SIconBtn onClick={e => { e.stopPropagation(); void handleDeleteExam(exam.id); }}><Trash2 size={12} /></SIconBtn>
                                    </td>
                                  </tr>
                                  {isExp && subEntries.length > 0 && (
                                    <tr style={{ borderBottom: idx < filteredExams.length - 1 ? "1px solid #F1F5F9" : "none" }}>
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
                                                  <td style={{ padding: "7px 10px", textAlign: "center" }}><SBadge bg={pctBg(sp)} color={pctColor(sp)}>{sp}%</SBadge></td>
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
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 成績分析 */}
              {scoreTab === "analysis" && (
                <div style={{ display: "grid", gap: 16 }}>
                  {devValues.length >= 2 && (
                    <div style={scoreCardStyle}>
                      <div style={{ ...cardTitleStyle, marginBottom: 14 }}>模試 偏差値の推移</div>
                      <TrendChart exams={mockExams.filter(e => e.total_deviation != null).reverse()} />
                    </div>
                  )}
                  {exams.length === 0 ? (
                    <ScoreEmpty />
                  ) : (
                    <>
                      {allSubjects.length > 0 && (
                        <div style={{ ...scoreCardStyle, padding: 0, overflow: "hidden" }}>
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
                                      <div style={{ fontSize: 9, color: "#94A3B8", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.exam_name.slice(0, 6)}</div>
                                    </th>
                                  ))}
                                  <th style={{ ...thStyle, minWidth: 60 }}>平均</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                                  <td style={{ padding: "9px 14px", fontWeight: 800, color: "#0F172A", fontSize: 12 }}>総合</td>
                                  {[...exams].reverse().map(e => {
                                    const p = e.total_score != null && e.total_max != null ? Math.round(e.total_score / e.total_max * 100) : null;
                                    return (
                                      <td key={e.id} style={{ padding: "7px 6px", textAlign: "center" }}>
                                        {p != null ? (
                                          <>
                                            <SBadge bg={pctBg(p)} color={pctColor(p)}>{p}%</SBadge>
                                            {e.total_deviation != null && <div style={{ fontSize: 10, fontWeight: 800, color: devColor(Number(e.total_deviation)), marginTop: 2 }}>偏{Number(e.total_deviation).toFixed(1)}</div>}
                                          </>
                                        ) : <span style={{ color: "#E2E8F0" }}>—</span>}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding: "7px 6px", textAlign: "center" }}>
                                    {avgDev != null && <span style={{ fontWeight: 800, color: devColor(avgDev) }}>偏{avgDev.toFixed(1)}</span>}
                                  </td>
                                </tr>
                                {allSubjects.map((subj, si) => {
                                  const stat = subjectStats.find(s => s.subj === subj);
                                  return (
                                    <tr key={subj} style={{ borderBottom: si < allSubjects.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                                      <td style={{ padding: "9px 14px", fontWeight: 700, color: SUBJECT_COLOR[subj] ?? "#64748B", whiteSpace: "nowrap" }}>{SUBJECT_LABEL[subj] ?? subj}</td>
                                      {[...exams].reverse().map(e => {
                                        const val = e.scores?.[subj];
                                        if (!val) return <td key={e.id} style={{ padding: "7px 6px", textAlign: "center", color: "#E2E8F0" }}>—</td>;
                                        const p = Math.round(val.score / val.max * 100);
                                        return (
                                          <td key={e.id} style={{ padding: "7px 6px", textAlign: "center" }}>
                                            <SBadge bg={pctBg(p)} color={pctColor(p)}>{p}%</SBadge>
                                            {val.deviation != null && <div style={{ fontSize: 10, fontWeight: 700, color: devColor(val.deviation), marginTop: 2 }}>偏{val.deviation.toFixed(1)}</div>}
                                          </td>
                                        );
                                      })}
                                      <td style={{ padding: "7px 6px", textAlign: "center" }}>
                                        {stat && <SBadge bg={pctBg(stat.pct)} color={pctColor(stat.pct)}>{stat.pct}%</SBadge>}
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
                      {subjectStats.length > 0 && (
                        <div style={scoreCardStyle}>
                          <div style={{ ...cardTitleStyle, marginBottom: 14 }}>科目別 平均得点率</div>
                          {subjectStats.map(({ subj, pct, avgDev: ad, count }) => (
                            <div key={subj} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <div style={{ width: 62, fontSize: 11, fontWeight: 700, color: SUBJECT_COLOR[subj] ?? "#64748B", textAlign: "right", flexShrink: 0 }}>{SUBJECT_LABEL[subj] ?? subj}</div>
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
          )}

        </main>
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
            <div style={{ marginBottom: 12 }}>
              <input list="exam-sugg" value={examName} onChange={e => setExamName(e.target.value)} placeholder="試験名を入力" style={hInputStyle} autoFocus />
              <datalist id="exam-sugg">{COMMON_EXAMS.map(n => <option key={n} value={n} />)}</datalist>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {COMMON_EXAMS.map(n => (
                <button key={n} onClick={() => setExamName(n)} style={{ ...pillBtnStyle, ...(examName === n ? pillActiveStyle : {}) }}>{n}</button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>受験日</p>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={hInputStyle} />
            </div>
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
    </AppLayout>
  );
}

// ── 振り返りタブ用サブコンポーネント ────────────────────────────
function SectionHead({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h2 style={{ margin: 0, fontSize: 18, color: "#0F172A" }}>{title}</h2>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" }}>{desc}</p>
    </div>
  );
}
function TopStatCard({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: ReactNode }) {
  return (
    <div style={topStatCardStyle}>
      <div style={topStatLabelStyle}>{icon}{label}</div>
      <div style={topStatValueStyle}>{value}</div>
      <div style={topStatHelperStyle}>{helper}</div>
    </div>
  );
}
function InsightRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div style={insightRowStyle}>
      <div>
        <div style={insightLabelStyle}>{label}</div>
        <div style={insightHelperStyle}>{helper}</div>
      </div>
      <div style={insightValueStyle}>{value}</div>
    </div>
  );
}
function MiniTrendCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ ...miniTrendCardStyle, borderColor: `${accent}22` }}>
      <div style={miniTrendLabelStyle}>{label}</div>
      <div style={{ ...miniTrendValueStyle, color: accent }}>{value}</div>
    </div>
  );
}
function StudyTimeLineChart({ weeks }: { weeks: ReflectionData["weeklyTrend"] }) {
  if (weeks.length === 0) return <div style={emptyStyle}>まだ勉強時間の記録が少ないため、推移グラフはこれから表示されます。</div>;
  const width = 680, height = 250, paddingX = 24, paddingTop = 18, paddingBottom = 42;
  const values = weeks.map((w) => w.studyMinutes);
  const max = Math.max(...values, 1);
  const innerWidth = width - paddingX * 2, innerHeight = height - paddingTop - paddingBottom;
  const points = weeks.map((w, i) => ({
    x: weeks.length === 1 ? width / 2 : paddingX + (innerWidth / (weeks.length - 1)) * i,
    y: paddingTop + innerHeight - (w.studyMinutes / max) * innerHeight,
    label: formatShortDate(w.week), value: w.studyMinutes,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = points.length > 0 ? `${path} L ${points.at(-1)?.x} ${paddingTop + innerHeight} L ${points[0]?.x} ${paddingTop + innerHeight} Z` : "";
  return (
    <div style={chartWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="studyArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(49,87,183,0.28)" />
            <stop offset="100%" stopColor="rgba(49,87,183,0.02)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#studyArea)" />
        <path d={path} fill="none" stroke="#3157B7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="5" fill="#FFFFFF" stroke="#3157B7" strokeWidth="3" />
            <text x={p.x} y={height - 14} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="700">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function SolvedQuestionsChart({ weeks }: { weeks: ReflectionData["weeklyTrend"] }) {
  if (weeks.length === 0) return <div style={emptyStyle}>まだ問題数や質問回数の記録が少ないため、比較グラフはこれから表示されます。</div>;
  const max = Math.max(...weeks.map((w) => Math.max(w.solved, w.questions)), 1);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {weeks.map((w) => (
        <div key={w.week} style={compareRowStyle}>
          <div style={{ width: 78, flexShrink: 0 }}>
            <div style={compareLabelStyle}>{formatShortDate(w.week)}</div>
            <div style={compareMetaStyle}>理解 {w.perfect} / 苦戦 {w.wrong}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
            <BarPair label="解いた問題" value={w.solved} max={max} color="#3157B7" />
            <BarPair label="質問回数" value={w.questions} max={max} color="#7C3AED" />
          </div>
        </div>
      ))}
    </div>
  );
}
function BarPair({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 800, color: "#0F172A" }}>{value}</span>
      </div>
      <div style={barTrackStyle}>
        <div style={{ ...barFillStyle, width: `${Math.max(8, Math.round((value / max) * 100))}%`, background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)` }} />
      </div>
    </div>
  );
}
function SplitCharts({ solved, questions, tasks, studyMinutes }: { solved: number; questions: number; tasks: number; studyMinutes: number }) {
  const total = Math.max(solved + questions + tasks, 1);
  const items = [
    { label: "解いた問題", value: solved, color: "#3157B7" },
    { label: "質問", value: questions, color: "#7C3AED" },
    { label: "完了タスク", value: tasks, color: "#0F766E" },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={ringWrapStyle}>
        <div style={{ ...ringStyle, background: `conic-gradient(#3157B7 0deg ${Math.round((solved / total) * 360)}deg, #7C3AED ${Math.round((solved / total) * 360)}deg ${Math.round(((solved + questions) / total) * 360)}deg, #0F766E ${Math.round(((solved + questions) / total) * 360)}deg 360deg)` }}>
          <div style={ringInnerStyle}>
            <div style={ringValueStyle}>{formatStudyMinutes(studyMinutes)}</div>
            <div style={ringLabelStyle}>累計勉強時間</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={legendRowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
              <span style={legendLabelStyle}>{item.label}</span>
            </div>
            <span style={legendValueStyle}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ExamTrendChart({ exams }: { exams: ReflectionData["exams"]["recent"] }) {
  const available = exams.filter((e) => e.total_deviation != null);
  if (available.length === 0) return <div style={emptyStyle}>偏差値付きの模試を登録すると、ここに推移グラフが表示されます。</div>;
  const width = 420, height = 210, paddingX = 22, paddingTop = 18, paddingBottom = 36;
  const values = available.map((e) => e.total_deviation ?? 0);
  const max = Math.max(...values, 50), min = Math.min(...values, 40), range = Math.max(max - min, 1);
  const innerWidth = width - paddingX * 2, innerHeight = height - paddingTop - paddingBottom;
  const points = available.map((e, i) => ({
    x: available.length === 1 ? width / 2 : paddingX + (innerWidth / (available.length - 1)) * i,
    y: paddingTop + innerHeight - ((( e.total_deviation ?? 0) - min) / range) * innerHeight,
    label: formatShortDate(e.exam_date), value: e.total_deviation ?? 0,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <div style={smallChartWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
        <path d={path} fill="none" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="5" fill="#FFFFFF" stroke="#0F766E" strokeWidth="3" />
            <text x={p.x} y={height - 12} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="700">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── 成績タブ用サブコンポーネント ────────────────────────────────
function ScoreCard({ label, value, color, diff, sub }: { label: string; value: string; color: string; diff?: number | null; sub?: string }) {
  return (
    <div style={scoreCardSummaryStyle}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -1 }}>{value}</span>
        {diff != null && (
          <span style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 1, color: diff > 0 ? "#059669" : diff < 0 ? "#DC2626" : "#94A3B8" }}>
            {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(diff).toFixed(1)}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}
function SBadge({ bg, color, children, large }: { bg: string; color: string; children: React.ReactNode; large?: boolean }) {
  return (
    <span style={{ display: "inline-block", padding: large ? "3px 11px" : "2px 8px", borderRadius: 999, fontSize: large ? 13 : 11, fontWeight: 800, background: bg, color }}>
      {children}
    </span>
  );
}
function SIconBtn({ children, onClick }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#CBD5E1", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
      {children}
    </button>
  );
}
function ScoreEmpty() {
  return (
    <div style={{ ...scoreCardStyle, padding: "48px 0", textAlign: "center", color: "#94A3B8" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>記録がありません</div>
      <div style={{ fontSize: 12, marginTop: 5 }}>「テスト記録」から追加してください</div>
    </div>
  );
}
function TrendChart({ exams }: { exams: MockExam[] }) {
  if (exams.length < 2) return null;
  const W = 680, H = 120, PX = 40, PY = 16, IW = W - PX * 2, IH = H - PY * 2;
  const devs = exams.map(e => Number(e.total_deviation));
  const maxD = Math.max(...devs, 70), minD = Math.min(...devs, 40), range = maxD - minD || 1;
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
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fontWeight="800" fill={devColor(Number(p.e.total_deviation))}>{Number(p.e.total_deviation).toFixed(1)}</text>
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize={9} fill="#94A3B8">{short(p.e.exam_date)}</text>
        </g>
      ))}
    </svg>
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

function buildSummaryTitle(data: ReflectionData) {
  if (data.continuity.currentStreak >= 7) return "かなりいい流れで積み上がっています";
  if (data.overview.thisWeekStudyMinutes >= 600) return "今週はしっかり勉強時間を確保できています";
  if (data.overview.monthlyQuestions >= 10) return "質問を活かしながら進められています";
  return "まずは今週の勉強時間をもう少し伸ばしたいです";
}
function buildSummaryBody(data: ReflectionData, weeklyAverage: number) {
  if (data.continuity.currentStreak >= 7) return `連続 ${data.continuity.currentStreak} 日を維持できています。週間平均は ${formatStudyMinutes(weeklyAverage)} で、かなり安定して積み上げられています。`;
  if (data.overview.thisWeekStudyMinutes >= 600) return `今週は ${formatStudyMinutes(data.overview.thisWeekStudyMinutes)} 勉強できています。量は十分あるので、次は苦戦した問題の見直しに時間を回すと伸びやすいです。`;
  if (data.overview.monthlyQuestions >= 10) return `今月は質問を ${data.overview.monthlyQuestions} 回使えていて、止まったところを放置せず進められています。勉強時間も一緒に伸ばせるとさらに良くなります。`;
  return `今週は ${formatStudyMinutes(data.overview.thisWeekStudyMinutes)} の積み上げです。まずは短い時間でもいいので、机に向かう回数を増やして流れを整えたいです。`;
}

// ── スタイル ─────────────────────────────────────────────────────
const loadingWrapStyle: CSSProperties = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" };
const spinnerStyle: CSSProperties = { width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(148,163,184,0.24)", borderTopColor: "#3157B7", animation: "spin 0.9s linear infinite" };
const spinnerStyle2: CSSProperties = { width: 28, height: 28, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "#3157B7", animation: "spin 0.8s linear infinite" };
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const mainStyle: CSSProperties = { maxWidth: 1120, margin: "0 auto", padding: "24px 16px 80px", display: "grid", gap: 20 };
const heroStyle: CSSProperties = { display: "grid", gap: 10 };
const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800, color: "#5470D9" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 900, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: 0, maxWidth: 760, fontSize: 14, lineHeight: 1.8, color: "#64748B" };
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 };
const twoColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 };
const threeColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.1fr 1.1fr 1fr", gap: 16 };
const cardStyle: CSSProperties = { borderRadius: 28, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", padding: 20 };
const topStatCardStyle: CSSProperties = { borderRadius: 22, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", padding: 18, display: "grid", gap: 8 };
const topStatLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#64748B" };
const topStatValueStyle: CSSProperties = { fontSize: 24, lineHeight: 1.2, fontWeight: 900, color: "#0F172A" };
const topStatHelperStyle: CSSProperties = { fontSize: 12, lineHeight: 1.6, color: "#94A3B8" };
const chartWrapStyle: CSSProperties = { height: 250, borderRadius: 22, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 12 };
const smallChartWrapStyle: CSSProperties = { height: 210, borderRadius: 22, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 12 };
const compareRowStyle: CSSProperties = { display: "flex", alignItems: "start", gap: 12, padding: 14, borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)" };
const compareLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0F172A" };
const compareMetaStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B" };
const barTrackStyle: CSSProperties = { height: 8, borderRadius: 999, background: "#E2E8F0", overflow: "hidden" };
const barFillStyle: CSSProperties = { height: "100%", borderRadius: 999 };
const ringWrapStyle: CSSProperties = { display: "grid", placeItems: "center" };
const ringStyle: CSSProperties = { width: 178, height: 178, borderRadius: "50%", display: "grid", placeItems: "center" };
const ringInnerStyle: CSSProperties = { width: 126, height: 126, borderRadius: "50%", background: "#FFFFFF", display: "grid", placeItems: "center", alignContent: "center", boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)" };
const ringValueStyle: CSSProperties = { fontSize: 20, fontWeight: 900, color: "#0F172A" };
const ringLabelStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B" };
const legendRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, padding: "10px 12px", background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)" };
const legendLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: "#334155" };
const legendValueStyle: CSSProperties = { fontSize: 14, fontWeight: 900, color: "#0F172A" };
const insightRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)" };
const insightLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0F172A" };
const insightHelperStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B" };
const insightValueStyle: CSSProperties = { fontSize: 18, fontWeight: 900, color: "#3157B7", textAlign: "right" };
const summaryBoxStyle: CSSProperties = { borderRadius: 20, background: "linear-gradient(180deg, #F8FBFF 0%, #F1F5FF 100%)", border: "1px solid rgba(84,112,217,0.14)", padding: 18, display: "grid", gap: 8 };
const summaryTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#0F172A" };
const summaryBodyStyle: CSSProperties = { fontSize: 13, lineHeight: 1.8, color: "#475569" };
const miniChartStackStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 14 };
const miniTrendCardStyle: CSSProperties = { borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: "#F8FAFC", padding: "12px 14px", display: "grid", gap: 4 };
const miniTrendLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748B" };
const miniTrendValueStyle: CSSProperties = { fontSize: 18, fontWeight: 900 };
const ctaRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const ctaStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46, padding: "0 18px", borderRadius: 999, background: "#0F172A", color: "#FFFFFF", fontSize: 14, fontWeight: 800 };
const ghostCtaStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 46, padding: "0 18px", borderRadius: 999, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", color: "#0F172A", fontSize: 14, fontWeight: 800 };
const emptyStyle: CSSProperties = { padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 };

// 成績タブ用スタイル
const scoreCardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const scoreCardSummaryStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const cardTitleStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0F172A" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#3157B7", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" };
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
