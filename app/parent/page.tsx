"use client";

import React, { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { SUBJECT_LABEL } from "@/lib/types";

type RouteStrategy = {
  overview: string;
  prioritySubjects: string[];
  firstWeekPolicy: string;
  warnings: string[];
};

type Student = {
  id: string;
  name: string;
  grade: number;
  target_univ: string | null;
  target_faculty: string | null;
  plan: string;
  current_level: number;
  target_level: number;
  subjects: string[];
  route_strategy: RouteStrategy | null;
  exam_date: string | null;
  xp: number;
};

type MockExam = {
  id: string;
  exam_name: string;
  exam_date: string;
  total_score: number | null;
  total_max: number | null;
  total_deviation: number | null;
};

type ActivityItem = {
  id: string;
  feed_type: string;
  title: string;
  body: string | null;
  xp_delta: number;
  created_at: string;
};

type ParentNote = {
  note: string | null;
  preferred_subjects: string[] | null;
  preferred_weekday_minutes: number | null;
  preferred_holiday_minutes: number | null;
  updated_at: string | null;
};

type DashboardData = {
  linked: boolean;
  student?: Student;
  stats?: {
    weekMinutes: number;
    monthMinutes: number;
    activeDays: number;
    badgeCount: number;
    activityCount: number;
  };
  mockExams?: MockExam[];
  recentActivity?: ActivityItem[];
  parentNote?: ParentNote | null;
  activeBook?: { title: string; subject: string } | null;
};

const PLAN_LABEL: Record<string, string> = {
  free: "無料プラン",
  basic: "AIパートナー",
  premium: "AI塾",
};

function formatDate(value: string | null) {
  if (!value) return "未設定";
  return new Date(value).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}時間${remain}分` : `${hours}時間`;
}

export default function ParentPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/parent/dashboard");
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    const json = (await response.json()) as DashboardData;
    setData(json);
    if (json.parentNote?.note) {
      setNoteText(json.parentNote.note);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function handleLink() {
    if (!linkEmail.trim()) return;
    setLinkLoading(true);
    setLinkError("");

    const response = await fetch("/api/parent/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childEmail: linkEmail.trim() }),
    });

    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      setLinkError(json.error ?? "お子さまの紐づけに失敗しました。");
      setLinkLoading(false);
      return;
    }

    setLinkEmail("");
    setLinkLoading(false);
    await load();
  }

  async function handleSaveNote() {
    setNoteSaving(true);
    await fetch("/api/parent/note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText }),
    });
    setNoteSaving(false);
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 1800);
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (!data?.linked || !data.student) {
    return (
      <div style={shellStyle}>
        <header style={headerStyle}>
          <div style={headerInnerStyle}>
            <Link href="/" style={logoStyle}>
              <span style={logoBadgeStyle}>AI</span>
              <span style={logoTextStyle}>永愛塾</span>
            </Link>
            <span style={headerRoleStyle}>
              <Users size={14} />
              保護者ダッシュボード
            </span>
          </div>
        </header>

        <main style={mainStyle}>
          <div style={emptyCardStyle}>
            <div style={emptyIconStyle}>
              <Users size={28} color="#059669" />
            </div>
            <h2 style={emptyHeadingStyle}>お子さまを紐づけて始めましょう</h2>
            <p style={emptyBodyStyle}>
              生徒のメールアドレスを入力すると、学習状況やAIの学習方針を保護者側から確認できます。
            </p>
            <div style={linkInputRowStyle}>
              <input
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="child@example.com"
                style={linkInputStyle}
              />
              <button
                onClick={() => void handleLink()}
                disabled={linkLoading || !linkEmail.trim()}
                style={linkButtonStyle(linkLoading || !linkEmail.trim())}
              >
                {linkLoading ? "連携中..." : "連携する"}
              </button>
            </div>
            {linkError && <p style={errorStyle}>{linkError}</p>}
          </div>
        </main>
      </div>
    );
  }

  const { student, stats, mockExams, recentActivity, parentNote, activeBook } = data;
  const strategy = student.route_strategy;

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoStyle}>
            <span style={logoBadgeStyle}>AI</span>
            <span style={logoTextStyle}>永愛塾</span>
          </Link>
          <span style={headerRoleStyle}>
            <Users size={14} />
            保護者ダッシュボード
          </span>
        </div>
      </header>

      <main style={mainStyle}>
        <section style={heroStyle}>
          <div style={avatarStyle}>{student.name.charAt(0)}</div>
          <div style={heroBodyStyle}>
            <div style={heroNameRowStyle}>
              <h1 style={studentNameStyle}>{student.name}</h1>
              <span style={smallPillStyle("#EEF4FF", "#3157B7")}>学年 {student.grade}</span>
              <span style={smallPillStyle("#F5F3FF", "#7C3AED")}>{PLAN_LABEL[student.plan] ?? student.plan}</span>
            </div>
            <div style={heroMetaRowStyle}>
              {student.target_univ && (
                <span style={metaPillStyle}>
                  <Target size={12} />
                  {student.target_univ}{student.target_faculty ? ` ${student.target_faculty}` : ""}
                </span>
              )}
              <span style={metaPillStyle}>
                <TrendingUp size={12} />
                Lv.{student.current_level} / 目標 Lv.{student.target_level}
              </span>
              {student.exam_date && (
                <span style={metaPillStyle}>
                  <Calendar size={12} />
                  受験日 {formatDate(student.exam_date)}
                </span>
              )}
            </div>
          </div>
        </section>

        <section style={statsGridStyle}>
          <StatCard
            icon={<Clock size={16} color="#3157B7" />}
            label="今週の勉強時間"
            value={formatMinutes(stats?.weekMinutes ?? 0)}
            sub={`今月 ${formatMinutes(stats?.monthMinutes ?? 0)}`}
            accent="#3157B7"
            background="#EEF4FF"
          />
          <StatCard
            icon={<CheckCircle2 size={16} color="#059669" />}
            label="今週の活動日数"
            value={`${stats?.activeDays ?? 0}日`}
            sub="勉強した日数"
            accent="#059669"
            background="#F0FDF4"
          />
          <StatCard
            icon={<BookOpen size={16} color="#D97706" />}
            label="バッジ数"
            value={`${stats?.badgeCount ?? 0}個`}
            sub={`現在XP ${student.xp}`}
            accent="#D97706"
            background="#FFFBEB"
          />
          <StatCard
            icon={<MessageSquare size={16} color="#7C3AED" />}
            label="最近の活動数"
            value={`${stats?.activityCount ?? 0}件`}
            sub="直近フィード"
            accent="#7C3AED"
            background="#F5F3FF"
          />
        </section>

        {activeBook && (
          <section style={cardStyle}>
            <p style={sectionEyebrowStyle}>いま進めている教材</p>
            <div style={activeBookStyle}>
              <BookOpen size={18} color="#3157B7" />
              <div>
                <p style={activeBookTitleStyle}>{activeBook.title}</p>
                <p style={activeBookMetaStyle}>{SUBJECT_LABEL[activeBook.subject] ?? activeBook.subject}</p>
              </div>
            </div>
          </section>
        )}

        {strategy && (
          <section style={strategyCardStyle}>
            <div style={sectionHeadStyle}>
              <p style={sectionEyebrowStyle}>AIが提案する学習方針</p>
              <h2 style={sectionTitleStyle}>今の進め方を一目で確認</h2>
            </div>
            <p style={strategyOverviewStyle}>{strategy.overview}</p>
            <div style={strategyGridStyle}>
              <div style={strategyItemStyle}>
                <p style={strategyLabelStyle}>優先科目</p>
                <div style={chipWrapStyle}>
                  {strategy.prioritySubjects.map((subject) => (
                    <span key={subject} style={subjectChipStyle}>
                      {SUBJECT_LABEL[subject] ?? subject}
                    </span>
                  ))}
                </div>
              </div>
              <div style={strategyItemStyle}>
                <p style={strategyLabelStyle}>最初の1週間</p>
                <p style={strategyBodyStyle}>{strategy.firstWeekPolicy}</p>
              </div>
            </div>
            {strategy.warnings.length > 0 && (
              <div style={warningBoxStyle}>
                <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={warningListStyle}>
                  {strategy.warnings.map((warning, index) => (
                    <p key={`${warning}-${index}`} style={warningTextStyle}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {(mockExams ?? []).length > 0 && (
          <section style={cardStyle}>
            <div style={sectionHeadStyle}>
              <p style={sectionEyebrowStyle}>成績の確認</p>
              <h2 style={sectionTitleStyle}>直近の模試</h2>
            </div>
            <div style={listStyle}>
              {(mockExams ?? []).map((mockExam) => (
                <div key={mockExam.id} style={mockRowStyle}>
                  <div>
                    <p style={rowTitleStyle}>{mockExam.exam_name}</p>
                    <p style={rowMetaStyle}>{formatDate(mockExam.exam_date)}</p>
                  </div>
                  <div style={scoreWrapStyle}>
                    {mockExam.total_score !== null && mockExam.total_max !== null && (
                      <div style={scoreBlockStyle}>
                        <p style={scoreValueStyle("#3157B7")}>
                          {mockExam.total_score}
                          <span style={scoreSubStyle}>/{mockExam.total_max}</span>
                        </p>
                        <p style={scoreLabelStyle}>得点</p>
                      </div>
                    )}
                    {mockExam.total_deviation !== null && (
                      <div style={scoreBlockStyle}>
                        <p style={scoreValueStyle("#7C3AED")}>{mockExam.total_deviation.toFixed(1)}</p>
                        <p style={scoreLabelStyle}>偏差値</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(recentActivity ?? []).length > 0 && (
          <section style={cardStyle}>
            <div style={sectionHeadStyle}>
              <p style={sectionEyebrowStyle}>最近の活動</p>
              <h2 style={sectionTitleStyle}>直近の積み上がり</h2>
            </div>
            <div style={listStyle}>
              {(recentActivity ?? []).map((activity) => (
                <div key={activity.id} style={activityRowStyle}>
                  <div style={activityTextWrapStyle}>
                    <p style={rowTitleStyle}>{activity.title}</p>
                    {activity.body && <p style={rowMetaStyle}>{activity.body}</p>}
                  </div>
                  <div style={activityMetaWrapStyle}>
                    <p style={activityDateStyle}>{formatDate(activity.created_at)}</p>
                    {activity.xp_delta > 0 && <p style={xpStyle}>+{activity.xp_delta} XP</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={cardStyle}>
          <div style={sectionHeadStyle}>
            <p style={sectionEyebrowStyle}>保護者メモ</p>
            <h2 style={sectionTitleStyle}>声かけや希望を残す</h2>
          </div>
          {parentNote?.updated_at && (
            <p style={updatedAtStyle}>最終更新: {formatDate(parentNote.updated_at)}</p>
          )}
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="例: 英語の勉強時間を少し増やしたい。数学は焦らず基礎を固めたい。"
            style={noteInputStyle}
            rows={4}
          />
          <button onClick={() => void handleSaveNote()} disabled={noteSaving} style={saveButtonStyle(noteSaving)}>
            {noteSaved ? "保存しました" : noteSaving ? "保存中..." : "メモを保存"}
          </button>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  background,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
  background: string;
}) {
  return (
    <div style={statCardStyle}>
      <div style={statHeadStyle}>
        <div style={{ ...statIconStyle, background }}>{icon}</div>
        <span style={statLabelStyle}>{label}</span>
      </div>
      <p style={{ ...statValueStyle, color: accent }}>{value}</p>
      <p style={statSubStyle}>{sub}</p>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F7F7F5",
};

const loadingStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid #E2E8F0",
  borderTop: "3px solid #3157B7",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid #E8E8E4",
};

const headerInnerStyle: CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "0 16px",
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const logoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
};

const logoBadgeStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "#1E293B",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
};

const logoTextStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#1E293B",
};

const headerRoleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "#059669",
  background: "#F0FDF4",
  padding: "6px 10px",
  borderRadius: 999,
};

const mainStyle: CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "20px 16px 80px",
  display: "grid",
  gap: 14,
};

const emptyCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 20,
  padding: "36px 28px",
  display: "grid",
  gap: 16,
  maxWidth: 500,
  margin: "40px auto",
};

const emptyIconStyle: CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 20,
  background: "#F0FDF4",
  display: "grid",
  placeItems: "center",
};

const emptyHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#0F172A",
};

const emptyBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#64748B",
  lineHeight: 1.8,
};

const linkInputRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
};

const linkInputStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  padding: "0 14px",
  fontSize: 14,
  color: "#0F172A",
  background: "#FAFAFA",
};

const linkButtonStyle = (disabled: boolean): CSSProperties => ({
  minHeight: 46,
  padding: "0 20px",
  borderRadius: 10,
  border: "none",
  background: disabled ? "#CBD5E1" : "#059669",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  cursor: disabled ? "default" : "pointer",
  whiteSpace: "nowrap",
});

const errorStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#DC2626",
  fontWeight: 700,
};

const heroStyle: CSSProperties = {
  background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 70%, #3157B7 100%)",
  borderRadius: 20,
  padding: "20px 22px",
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const avatarStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 20,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const heroBodyStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const heroNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const studentNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const smallPillStyle = (background: string, color: string): CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  background,
  color,
  fontSize: 12,
  fontWeight: 700,
});

const heroMetaRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const metaPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 700,
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 16,
  padding: "14px 16px",
  display: "grid",
  gap: 8,
};

const statHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const statIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
};

const statLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#64748B",
};

const statValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
};

const statSubStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#94A3B8",
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 12,
};

const sectionHeadStyle: CSSProperties = {
  display: "grid",
  gap: 2,
};

const sectionEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#94A3B8",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0F172A",
};

const activeBookStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  background: "#EEF4FF",
  borderRadius: 14,
};

const activeBookTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0F172A",
};

const activeBookMetaStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: 12,
  color: "#64748B",
};

const strategyCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, #EEF4FF 0%, #F8FAFF 100%)",
  border: "1px solid #B2DDFF",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 12,
};

const strategyOverviewStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.8,
  color: "#0F172A",
  fontWeight: 600,
};

const strategyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const strategyItemStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: "12px 14px",
  display: "grid",
  gap: 8,
  border: "1px solid #DBEAFE",
};

const strategyLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#175CD3",
};

const strategyBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#0F172A",
  lineHeight: 1.7,
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const subjectChipStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#EEF4FF",
  color: "#175CD3",
  fontSize: 12,
  fontWeight: 700,
};

const warningBoxStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  background: "#FFFBEB",
  border: "1px solid #FDE68A",
  borderRadius: 12,
  padding: "10px 14px",
};

const warningListStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const warningTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.6,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const mockRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  background: "#F8FAFC",
  borderRadius: 12,
  gap: 12,
};

const rowTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: "#0F172A",
};

const rowMetaStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: 12,
  color: "#64748B",
};

const scoreWrapStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
};

const scoreBlockStyle: CSSProperties = {
  textAlign: "right",
};

const scoreValueStyle = (color: string): CSSProperties => ({
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color,
});

const scoreSubStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748B",
};

const scoreLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#64748B",
};

const activityRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #F1F5F9",
};

const activityTextWrapStyle: CSSProperties = {
  display: "grid",
  gap: 2,
};

const activityMetaWrapStyle: CSSProperties = {
  textAlign: "right",
  flexShrink: 0,
};

const activityDateStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#94A3B8",
};

const xpStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: 11,
  color: "#D97706",
  fontWeight: 700,
};

const updatedAtStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#94A3B8",
};

const noteInputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  padding: "12px 14px",
  fontSize: 14,
  color: "#0F172A",
  lineHeight: 1.7,
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
  background: "#FAFAFA",
};

const saveButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: "12px 20px",
  borderRadius: 12,
  border: "none",
  background: disabled ? "#CBD5E1" : "#3157B7",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  cursor: disabled ? "default" : "pointer",
  justifySelf: "start",
});
