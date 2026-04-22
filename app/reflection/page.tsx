"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { Activity, Brain, CalendarDays, Clock3, Flame, GraduationCap, MessageSquareText, TrendingUp } from "lucide-react";

type ReflectionData = {
  student: {
    name: string;
    targetUniv: string | null;
    examDate: string | null;
    xp: number;
  };
  overview: {
    totalStudyMinutes: number;
    thisWeekStudyMinutes: number;
    thisMonthStudyMinutes: number;
    totalSolved: number;
    monthlySolved: number;
    totalQuestions: number;
    monthlyQuestions: number;
    completedTasks: number;
  };
  continuity: {
    currentStreak: number;
    longestStreak: number;
    activeDays: number;
    unlockedBadgeIds: string[];
  };
  weeklyTrend: Array<{
    week: string;
    studyMinutes: number;
    solved: number;
    perfect: number;
    wrong: number;
    questions: number;
  }>;
  exams: {
    latest: {
      id: string;
      exam_name: string;
      exam_date: string;
      total_score: number | null;
      total_max: number | null;
      total_deviation: number | null;
    } | null;
    recent: Array<{
      id: string;
      exam_name: string;
      exam_date: string;
      total_score: number | null;
      total_max: number | null;
      total_deviation: number | null;
    }>;
    count: number;
    deviationChange: number | null;
  };
};

export default function ReflectionPage() {
  const [data, setData] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reflection", { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      })
      .finally(() => setLoading(false));
  }, []);

  const weeklyAverage = useMemo(() => {
    if (!data || data.weeklyTrend.length === 0) return 0;
    return Math.round(data.weeklyTrend.reduce((sum, week) => sum + week.studyMinutes, 0) / data.weeklyTrend.length);
  }, [data]);

  if (loading) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div style={pageStyle}>
          <main style={mainStyle}>
            <div style={emptyStyle}>振り返りデータを読み込めませんでした。</div>
          </main>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>
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
              <SectionHead
                icon={<TrendingUp size={16} color="#3157B7" />}
                title="勉強時間の推移"
                desc="週ごとの勉強時間を折れ線で見て、最近のリズムをつかみます。"
              />
              <StudyTimeLineChart weeks={data.weeklyTrend} />
            </div>

            <div style={cardStyle}>
              <SectionHead
                icon={<Activity size={16} color="#3157B7" />}
                title="問題・質問のバランス"
                desc="どれだけ解けていて、どれだけ質問しているかを同時に見返せます。"
              />
              <SolvedQuestionsChart weeks={data.weeklyTrend} />
            </div>
          </section>

          <section style={threeColStyle}>
            <div style={cardStyle}>
              <SectionHead
                icon={<Brain size={16} color="#3157B7" />}
                title="学習の内訳"
                desc="今の積み上がりを割合で見て、どこが強いかを一目で把握できます。"
              />
              <SplitCharts
                solved={data.overview.totalSolved}
                questions={data.overview.totalQuestions}
                tasks={data.overview.completedTasks}
                studyMinutes={data.overview.totalStudyMinutes}
              />
            </div>

            <div style={cardStyle}>
              <SectionHead
                icon={<GraduationCap size={16} color="#3157B7" />}
                title="模試の推移"
                desc="偏差値や点数の流れを見て、最近の成績の動きを確認できます。"
              />
              <ExamTrendChart exams={data.exams.recent.slice().reverse()} />
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <InsightRow label="直近の模試" value={data.exams.latest ? data.exams.latest.exam_name : "未登録"} helper={data.exams.latest ? formatDate(data.exams.latest.exam_date) : "まずは模試を登録"} />
                <InsightRow label="偏差値の変化" value={data.exams.deviationChange == null ? "-" : `${data.exams.deviationChange > 0 ? "+" : ""}${data.exams.deviationChange}`} helper="最初の模試からの変化" />
              </div>
            </div>

            <div style={cardStyle}>
              <SectionHead
                icon={<Activity size={16} color="#3157B7" />}
                title="今のひとこと"
                desc="最近の流れから、今の状態を短くまとめています。"
              />
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
                <Link href="/practice" style={ctaStyle}>演習を始める</Link>
                <Link href="/my-sensei" style={ghostCtaStyle}>My先生に相談</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AppLayout>
  );
}

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
      <div style={topStatLabelStyle}>
        {icon}
        {label}
      </div>
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
  if (weeks.length === 0) {
    return <div style={emptyStyle}>まだ勉強時間の記録が少ないため、推移グラフはこれから表示されます。</div>;
  }

  const width = 680;
  const height = 250;
  const paddingX = 24;
  const paddingTop = 18;
  const paddingBottom = 42;
  const values = weeks.map((week) => week.studyMinutes);
  const max = Math.max(...values, 1);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = weeks.map((week, index) => {
    const x = weeks.length === 1 ? width / 2 : paddingX + (innerWidth / (weeks.length - 1)) * index;
    const y = paddingTop + innerHeight - (week.studyMinutes / max) * innerHeight;
    return { x, y, label: formatShortDate(week.week), value: week.studyMinutes };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
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
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#FFFFFF" stroke="#3157B7" strokeWidth="3" />
            <text x={point.x} y={height - 14} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="700">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SolvedQuestionsChart({ weeks }: { weeks: ReflectionData["weeklyTrend"] }) {
  if (weeks.length === 0) {
    return <div style={emptyStyle}>まだ問題数や質問回数の記録が少ないため、比較グラフはこれから表示されます。</div>;
  }

  const max = Math.max(...weeks.map((week) => Math.max(week.solved, week.questions)), 1);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {weeks.map((week) => (
        <div key={week.week} style={compareRowStyle}>
          <div style={{ width: 78, flexShrink: 0 }}>
            <div style={compareLabelStyle}>{formatShortDate(week.week)}</div>
            <div style={compareMetaStyle}>理解 {week.perfect} / 苦戦 {week.wrong}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
            <BarPair label="解いた問題" value={week.solved} max={max} color="#3157B7" />
            <BarPair label="質問回数" value={week.questions} max={max} color="#7C3AED" />
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
        <div
          style={{
            ...barFillStyle,
            width: `${Math.max(8, Math.round((value / max) * 100))}%`,
            background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function SplitCharts({
  solved,
  questions,
  tasks,
  studyMinutes,
}: {
  solved: number;
  questions: number;
  tasks: number;
  studyMinutes: number;
}) {
  const total = Math.max(solved + questions + tasks, 1);
  const items = [
    { label: "解いた問題", value: solved, color: "#3157B7" },
    { label: "質問", value: questions, color: "#7C3AED" },
    { label: "完了タスク", value: tasks, color: "#0F766E" },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={ringWrapStyle}>
        <div
          style={{
            ...ringStyle,
            background: `conic-gradient(
              #3157B7 0deg ${Math.round((solved / total) * 360)}deg,
              #7C3AED ${Math.round((solved / total) * 360)}deg ${Math.round(((solved + questions) / total) * 360)}deg,
              #0F766E ${Math.round(((solved + questions) / total) * 360)}deg 360deg
            )`,
          }}
        >
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
  const available = exams.filter((exam) => exam.total_deviation != null);
  if (available.length === 0) {
    return <div style={emptyStyle}>偏差値付きの模試を登録すると、ここに推移グラフが表示されます。</div>;
  }

  const width = 420;
  const height = 210;
  const paddingX = 22;
  const paddingTop = 18;
  const paddingBottom = 36;
  const values = available.map((exam) => exam.total_deviation ?? 0);
  const max = Math.max(...values, 50);
  const min = Math.min(...values, 40);
  const range = Math.max(max - min, 1);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = available.map((exam, index) => {
    const value = exam.total_deviation ?? 0;
    const x = available.length === 1 ? width / 2 : paddingX + (innerWidth / (available.length - 1)) * index;
    const y = paddingTop + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y, label: formatShortDate(exam.exam_date), value };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div style={smallChartWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
        <path d={path} fill="none" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#FFFFFF" stroke="#0F766E" strokeWidth="3" />
            <text x={point.x} y={height - 12} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="700">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
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
  if (data.continuity.currentStreak >= 7) {
    return `連続 ${data.continuity.currentStreak} 日を維持できています。週間平均は ${formatStudyMinutes(weeklyAverage)} で、かなり安定して積み上げられています。`;
  }
  if (data.overview.thisWeekStudyMinutes >= 600) {
    return `今週は ${formatStudyMinutes(data.overview.thisWeekStudyMinutes)} 勉強できています。量は十分あるので、次は苦戦した問題の見直しに時間を回すと伸びやすいです。`;
  }
  if (data.overview.monthlyQuestions >= 10) {
    return `今月は質問を ${data.overview.monthlyQuestions} 回使えていて、止まったところを放置せず進められています。勉強時間も一緒に伸ばせるとさらに良くなります。`;
  }
  return `今週は ${formatStudyMinutes(data.overview.thisWeekStudyMinutes)} の積み上げです。まずは短い時間でもいいので、机に向かう回数を増やして流れを整えたいです。`;
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

const loadingWrapStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "3px solid rgba(148,163,184,0.24)",
  borderTopColor: "#3157B7",
  animation: "spin 0.9s linear infinite",
};
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
const emptyStyle: CSSProperties = { borderRadius: 20, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 20, fontSize: 13, lineHeight: 1.8, color: "#64748B", textAlign: "center" };
