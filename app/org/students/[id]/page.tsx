"use client";

import React, { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Target, TrendingUp } from "lucide-react";
import { SUBJECT_LABEL } from "@/lib/types";

type StudentDetail = {
  id: string;
  name: string;
  grade: number;
  target_univ: string | null;
  target_faculty: string | null;
  exam_type: string | null;
  plan: string;
  current_level: number;
  target_level: number;
  subjects: string[];
  route_strategy: {
    overview: string;
    prioritySubjects: string[];
    firstWeekPolicy: string;
    warnings: string[];
  } | null;
  exam_date: string | null;
  xp: number;
  study_style: string | null;
  biggest_blocker: string | null;
  strength_subjects: string[] | null;
  weakness_subjects: string[] | null;
  onboarding_summary: string | null;
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

type RouteItem = {
  id: string;
  step_order: number;
  status: string;
  books: { title: string; subject: string; level: number } | null;
};

type StaffNote = {
  id: string;
  note: string;
  author_user_id: string;
  created_at: string;
  updated_at: string;
};

type DetailData = {
  student?: StudentDetail;
  stats?: { weekMinutes: number; monthMinutes: number };
  mockExams?: MockExam[];
  routes?: RouteItem[];
  recentActivity?: ActivityItem[];
  staffNotes?: StaffNote[];
  error?: string;
};

const EXAM_TYPE_LABEL: Record<string, string> = {
  general: "一般入試",
  csat: "共通テスト利用",
  recommendation: "推薦",
};

const STYLE_LABEL: Record<string, string> = {
  planner: "計画型",
  steady: "積み上げ型",
  sprinter: "追い込み型",
  mood: "波があるタイプ",
};

const BLOCKER_LABEL: Record<string, string> = {
  start: "始めるまでに時間がかかる",
  continue: "続けるのが苦手",
  questions: "わからない所で止まりやすい",
  schedule: "予定に流されやすい",
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

function statusLabel(status: string) {
  if (status === "in_progress") return "進行中";
  if (status === "done" || status === "completed") return "完了";
  return "未着手";
}

function statusColor(status: string) {
  if (status === "in_progress") return "#3157B7";
  if (status === "done" || status === "completed") return "#059669";
  return "#94A3B8";
}

export default function OrgStudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/org/students/${studentId}`);
    if (response.status === 401 || response.status === 403) {
      router.push("/org");
      return;
    }
    const json = (await response.json()) as DetailData;
    setData(json);
    setLoading(false);
  }, [studentId, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setNoteLoading(true);
    await fetch("/api/org/staff-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, note: newNote }),
    });
    setNewNote("");
    await load();
    setNoteLoading(false);
  }

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (!data?.student) {
    return (
      <div style={shellStyle}>
        <div style={notFoundStyle}>
          <p style={notFoundTextStyle}>生徒情報を取得できませんでした。</p>
          <Link href="/org" style={backLinkStyle}>
            <ArrowLeft size={14} />
            生徒一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const { student, stats, mockExams, routes, recentActivity, staffNotes } = data;

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/org" style={backLinkStyle}>
            <ArrowLeft size={16} />
            生徒一覧へ戻る
          </Link>
          <span style={headerLabelStyle}>塾・学校ダッシュボード</span>
        </div>
      </header>

      <main style={mainStyle}>
        <section style={heroStyle}>
          <div style={heroAvatarStyle}>{student.name.charAt(0)}</div>
          <div style={heroBodyStyle}>
            <div style={heroNameRowStyle}>
              <h1 style={studentNameStyle}>{student.name}</h1>
              <span style={pillStyle("#EEF4FF", "#3157B7")}>学年 {student.grade}</span>
              {student.exam_type && (
                <span style={pillStyle("#F5F3FF", "#7C3AED")}>
                  {EXAM_TYPE_LABEL[student.exam_type] ?? student.exam_type}
                </span>
              )}
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
                <span style={metaPillStyle}>受験日 {formatDate(student.exam_date)}</span>
              )}
            </div>
          </div>
        </section>

        <section style={statsRowStyle}>
          <StatBox label="今週の勉強時間" value={formatMinutes(stats?.weekMinutes ?? 0)} color="#3157B7" />
          <StatBox label="今月の勉強時間" value={formatMinutes(stats?.monthMinutes ?? 0)} color="#059669" />
          <StatBox label="現在レベル" value={`Lv.${student.current_level}`} color="#7C3AED" />
          <StatBox label="目標レベル" value={`Lv.${student.target_level}`} color="#D97706" />
        </section>

        <div style={gridStyle}>
          <div style={columnStyle}>
            <section style={cardStyle}>
              <h2 style={cardTitleStyle}>基本情報</h2>
              <div style={infoGridStyle}>
                <InfoRow label="科目" value={student.subjects.map((subject) => SUBJECT_LABEL[subject] ?? subject).join(" / ")} />
                {student.study_style && (
                  <InfoRow label="学習タイプ" value={STYLE_LABEL[student.study_style] ?? student.study_style} />
                )}
                {student.biggest_blocker && (
                  <InfoRow label="つまずきやすい点" value={BLOCKER_LABEL[student.biggest_blocker] ?? student.biggest_blocker} />
                )}
                {student.strength_subjects?.length ? (
                  <InfoRow label="得意科目" value={student.strength_subjects.map((subject) => SUBJECT_LABEL[subject] ?? subject).join(" / ")} />
                ) : null}
                {student.weakness_subjects?.length ? (
                  <InfoRow label="苦手科目" value={student.weakness_subjects.map((subject) => SUBJECT_LABEL[subject] ?? subject).join(" / ")} />
                ) : null}
              </div>
              {student.onboarding_summary && (
                <div style={summaryBoxStyle}>
                  <p style={summaryTextStyle}>{student.onboarding_summary}</p>
                </div>
              )}
            </section>

            {student.route_strategy && (
              <section style={strategyCardStyle}>
                <h2 style={cardTitleStyle}>AI学習方針</h2>
                <p style={strategyOverviewStyle}>{student.route_strategy.overview}</p>
                <div>
                  <p style={miniLabelStyle}>優先科目</p>
                  <div style={chipWrapStyle}>
                    {student.route_strategy.prioritySubjects.map((subject) => (
                      <span key={subject} style={pillStyle("#EEF4FF", "#3157B7")}>
                        {SUBJECT_LABEL[subject] ?? subject}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={miniLabelStyle}>最初の1週間</p>
                  <p style={strategyBodyStyle}>{student.route_strategy.firstWeekPolicy}</p>
                </div>
              </section>
            )}

            {(mockExams ?? []).length > 0 && (
              <section style={cardStyle}>
                <h2 style={cardTitleStyle}>模試推移</h2>
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
          </div>

          <div style={columnStyle}>
            {(routes ?? []).length > 0 && (
              <section style={cardStyle}>
                <h2 style={cardTitleStyle}>学習ルートの進み</h2>
                <div style={listStyle}>
                  {(routes ?? []).map((route) => (
                    <div key={route.id} style={routeRowStyle}>
                      <span style={stepOrderStyle}>{route.step_order}</span>
                      <div style={routeBodyStyle}>
                        <p style={rowTitleStyle}>{route.books?.title ?? "教材未設定"}</p>
                        <p style={rowMetaStyle}>
                          {route.books ? (SUBJECT_LABEL[route.books.subject] ?? route.books.subject) : ""}
                        </p>
                      </div>
                      <span style={{ ...statusPillStyle, color: statusColor(route.status) }}>
                        {statusLabel(route.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(recentActivity ?? []).length > 0 && (
              <section style={cardStyle}>
                <h2 style={cardTitleStyle}>最近の活動</h2>
                <div style={listStyle}>
                  {(recentActivity ?? []).slice(0, 10).map((activity) => (
                    <div key={activity.id} style={activityRowStyle}>
                      <div>
                        <p style={rowTitleStyle}>{activity.title}</p>
                        {activity.body && <p style={rowMetaStyle}>{activity.body}</p>}
                      </div>
                      <span style={activityDateStyle}>{formatDate(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={cardStyle}>
              <h2 style={cardTitleStyle}>スタッフメモ</h2>
              <div style={listStyle}>
                {(staffNotes ?? []).map((note) => (
                  <div key={note.id} style={noteItemStyle}>
                    <p style={noteTextStyle}>{note.note}</p>
                    <p style={noteDateStyle}>{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
              <div style={noteFormStyle}>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="面談メモや次回の確認ポイントを残す"
                  rows={3}
                  style={noteInputStyle}
                />
                <button
                  onClick={() => void handleAddNote()}
                  disabled={noteLoading || !newNote.trim()}
                  style={addNoteButtonStyle(noteLoading || !newNote.trim())}
                >
                  {noteLoading ? "保存中..." : "メモを追加"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={statCardStyle}>
      <p style={statLabelStyle}>{label}</p>
      <p style={{ ...statValueStyle, color }}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
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
  borderTop: "3px solid #7C3AED",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const notFoundStyle: CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
};

const notFoundTextStyle: CSSProperties = {
  margin: "0 0 12px",
  color: "#64748B",
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
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 16px",
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const backLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: "#475569",
  textDecoration: "none",
};

const headerLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#7C3AED",
  background: "#F5F3FF",
  padding: "5px 10px",
  borderRadius: 999,
};

const mainStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "20px 16px 80px",
  display: "grid",
  gap: 14,
};

const heroStyle: CSSProperties = {
  background: "linear-gradient(135deg, #1E293B 0%, #2D3B6B 100%)",
  borderRadius: 18,
  padding: "20px 22px",
  display: "flex",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const heroAvatarStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 18,
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
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const pillStyle = (background: string, color: string): CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  background,
  color,
  fontSize: 12,
  fontWeight: 700,
});

const heroMetaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const metaPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 700,
};

const statsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 14,
  padding: "12px 16px",
  display: "grid",
  gap: 4,
};

const statLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  color: "#94A3B8",
};

const statValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  alignItems: "start",
};

const columnStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 16,
  padding: "14px 16px",
  display: "grid",
  gap: 12,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: "#0F172A",
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const infoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "96px 1fr",
  gap: 10,
  alignItems: "start",
};

const infoLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#94A3B8",
};

const infoValueStyle: CSSProperties = {
  fontSize: 13,
  color: "#0F172A",
  fontWeight: 600,
  lineHeight: 1.6,
};

const summaryBoxStyle: CSSProperties = {
  background: "#F8FAFC",
  borderRadius: 10,
  padding: "10px 12px",
  marginTop: 4,
};

const summaryTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.7,
};

const strategyCardStyle: CSSProperties = {
  background: "#EEF4FF",
  border: "1px solid #B2DDFF",
  borderRadius: 16,
  padding: "14px 16px",
  display: "grid",
  gap: 10,
};

const strategyOverviewStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.8,
  color: "#0F172A",
};

const miniLabelStyle: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#175CD3",
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const strategyBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#0F172A",
  lineHeight: 1.7,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const mockRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  background: "#F8FAFC",
  borderRadius: 10,
  gap: 10,
};

const rowTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const rowMetaStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#64748B",
};

const scoreWrapStyle: CSSProperties = {
  display: "flex",
  gap: 14,
};

const scoreBlockStyle: CSSProperties = {
  textAlign: "right",
};

const scoreValueStyle = (color: string): CSSProperties => ({
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color,
});

const scoreSubStyle: CSSProperties = {
  fontSize: 11,
  color: "#94A3B8",
};

const scoreLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#64748B",
};

const routeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: "#F8FAFC",
  borderRadius: 10,
};

const stepOrderStyle: CSSProperties = {
  fontSize: 11,
  color: "#94A3B8",
  fontWeight: 700,
  width: 18,
  flexShrink: 0,
};

const routeBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const statusPillStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  flexShrink: 0,
};

const activityRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  paddingBottom: 8,
  borderBottom: "1px solid #F1F5F9",
};

const activityDateStyle: CSSProperties = {
  fontSize: 11,
  color: "#94A3B8",
  flexShrink: 0,
};

const noteItemStyle: CSSProperties = {
  padding: "10px 12px",
  background: "#FFFBEB",
  borderRadius: 10,
  border: "1px solid #FDE68A",
};

const noteTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#0F172A",
  lineHeight: 1.7,
};

const noteDateStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: "#94A3B8",
};

const noteFormStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const noteInputStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  padding: "10px 12px",
  fontSize: 13,
  color: "#0F172A",
  resize: "vertical",
  fontFamily: "inherit",
  background: "#FAFAFA",
  width: "100%",
  boxSizing: "border-box",
};

const addNoteButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: disabled ? "#CBD5E1" : "#7C3AED",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: disabled ? "default" : "pointer",
  justifySelf: "start",
});
