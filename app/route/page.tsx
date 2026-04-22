"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { SUBJECT_BG, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";
import { Atom, BookMarked, BookOpen, Clock3, FlaskConical, Globe, Landmark, Leaf, Map, School, Sigma, Target, Users } from "lucide-react";

type BookInfo = {
  id: string;
  title: string;
  subject: string;
  level: number;
  total_problems: number;
  weeks_estimate: number;
  category: string;
};

type RouteItem = {
  id: string;
  step_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  source: string;
  concurrent: boolean;
  books: BookInfo | null;
};

type StudentInfo = {
  id: string;
  name: string;
  current_level: number;
  target_level: number;
  target_univ: string | null;
  subjects: string[];
  plan: string;
  exam_date: string | null;
};

type SubjectKey = "math" | "physics" | "chemistry" | "biology" | "english" | "japanese" | "world_history" | "japanese_history" | "geography" | "civics" | "information" | "other";

const SUBJECTS: SubjectKey[] = ["math", "physics", "chemistry", "biology", "english", "japanese", "world_history", "japanese_history", "geography", "civics", "information", "other"];
const SUBJECT_ICONS: Record<SubjectKey, React.ElementType> = {
  math: Sigma,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Leaf,
  english: BookOpen,
  japanese: BookOpen,
  world_history: Globe,
  japanese_history: Landmark,
  geography: Map,
  civics: Users,
  information: School,
  other: BookMarked,
};

function formatDate(date: string | null) {
  if (!date) return "未設定";
  return new Date(date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function daysLeftLabel(date: string | null) {
  if (!date) return "受験日未設定";
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff > 0 ? `受験まであと${diff}日` : "受験日を過ぎています";
}

function statusLabel(status: string) {
  if (status === "done" || status === "completed") return "完了";
  if (status === "in_progress") return "進行中";
  return "未着手";
}

function statusTone(status: string) {
  if (status === "done" || status === "completed") {
    return { bg: "#ECFDF3", text: "#027A48", border: "#A6F4C5" };
  }
  if (status === "in_progress") {
    return { bg: "#EEF4FF", text: "#175CD3", border: "#B2DDFF" };
  }
  return { bg: "#F8FAFC", text: "#475467", border: "#D0D5DD" };
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function diffInMonths(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function formatMonth(date: Date) {
  return `${date.getMonth() + 1}月`;
}

function buildRouteTimeline(items: RouteItem[]) {
  const sorted = [...items].sort((a, b) => a.step_order - b.step_order);
  const startBase = monthStart(new Date());
  let cursor = new Date(startBase);

  return sorted.map((item) => {
    const start = item.started_at ? monthStart(new Date(item.started_at)) : new Date(cursor);
    const span = Math.max(1, Math.ceil((item.books?.weeks_estimate ?? 4) / 4));
    const end = item.completed_at ? monthStart(new Date(item.completed_at)) : addMonths(start, span - 1);
    if (!item.concurrent) {
      cursor = addMonths(end, 1);
    }

    return {
      ...item,
      planStart: start,
      planEnd: end,
      span,
    };
  });
}

export default function RoutePage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubjects, setOpenSubjects] = useState<Record<SubjectKey, boolean>>({
    math: true, physics: true, chemistry: true, biology: true,
    english: true, japanese: true, world_history: true, japanese_history: true,
    geography: true, civics: true, information: true, other: true,
  });

  const fetchRoutes = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: studentData } = await supabase
      .from("students")
      .select("id, name, current_level, target_level, target_univ, subjects, plan, exam_date")
      .eq("user_id", user.id)
      .single();

    if (!studentData) {
      router.push("/schedule");
      return;
    }

    setStudent(studentData);

    const { data, error } = await supabase
      .from("student_routes")
      .select(
        "id, step_order, status, started_at, completed_at, source, concurrent, books(id, title, subject, level, total_problems, weeks_estimate, category)"
      )
      .eq("student_id", studentData.id)
      .order("step_order", { ascending: true });

    if (error) {
      const { data: fallback } = await supabase
        .from("student_routes")
        .select(
          "id, step_order, status, started_at, completed_at, source, books(id, title, subject, level, total_problems, weeks_estimate, category)"
        )
        .eq("student_id", studentData.id)
        .order("step_order", { ascending: true });
      setRoutes(((fallback ?? []) as unknown as Omit<RouteItem, "concurrent">[]).map((item) => ({ ...item, concurrent: false })));
    } else {
      setRoutes((data ?? []) as unknown as RouteItem[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchRoutes();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchRoutes]);

  const aiRoutes = useMemo(() => routes.filter((route) => (route.source ?? "ai") === "ai" && route.status !== "skipped"), [routes]);
  const completedCount = aiRoutes.filter((route) => route.status === "done" || route.status === "completed").length;
  const inProgressCount = aiRoutes.filter((route) => route.status === "in_progress").length;
  const progress = aiRoutes.length > 0 ? Math.round((completedCount / aiRoutes.length) * 100) : 0;
  const currentBook = aiRoutes.find((route) => route.status === "in_progress");

  const subjectGroups = useMemo(() => {
    return SUBJECTS.map((subject) => ({
      subject,
      items: aiRoutes.filter((route) => route.books?.subject === subject),
    })).filter((group) => group.items.length > 0);
  }, [aiRoutes]);

  const timelineMonths = useMemo(() => {
    const base = monthStart(new Date());
    const examBase = student?.exam_date ? monthStart(new Date(student.exam_date)) : addMonths(base, 5);
    const lastMonth = diffInMonths(base, examBase) < 5 ? addMonths(base, 5) : examBase;
    const count = diffInMonths(base, lastMonth) + 1;
    return Array.from({ length: count }, (_, index) => addMonths(base, index));
  }, [student]);

  const timelineGroups = useMemo(() => {
    return subjectGroups.map(({ subject, items }) => ({
      subject,
      items: buildRouteTimeline(items),
    }));
  }, [subjectGroups]);

  const toggleConcurrent = useCallback(async (routeId: string, current: boolean) => {
    setRoutes((prev) => prev.map((route) => (route.id === routeId ? { ...route, concurrent: !current } : route)));
    const res = await fetch("/api/route-concurrent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeId, concurrent: !current }),
    });
    if (!res.ok) {
      setRoutes((prev) => prev.map((route) => (route.id === routeId ? { ...route, concurrent: current } : route)));
    }
  }, []);

  if (loading || !student) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Learning Route</p>
            <h1 style={titleStyle}>迷わず進める学習ルート</h1>
            <p style={descriptionStyle}>
              今やる教材と、その次に待っている一冊までが見える状態に整えています。今日の一歩を決めやすくするための画面です。
            </p>
          </div>
          <div style={heroMetaStyle}>
            {student.target_univ && (
              <span style={metaPillStyle}>
                <Target size={13} />
                {student.target_univ}
              </span>
            )}
            <span style={metaPillStyle}>
              <Clock3 size={13} />
              {daysLeftLabel(student.exam_date)}
            </span>
          </div>
        </section>

        <section style={statsGridStyle}>
          <StatCard label="ルート進行率" value={`${progress}%`} sub={`${completedCount} / ${aiRoutes.length || 0}冊完了`} accent="var(--accent)" />
          <StatCard label="いま進行中" value={String(inProgressCount)} sub={currentBook?.books?.title ?? "次の教材を待機中"} accent="#175CD3" />
          <StatCard
            label="現在の学習ルートレベル"
            value={`Lv.${student.current_level}`}
            sub={`目標 学習ルートLv.${student.target_level}`}
            accent="#9333EA"
          />
        </section>

        <section style={cardStyle}>
          <div style={sectionHeadStyle}>
            <div>
              <p style={sectionEyebrowStyle}>Current Focus</p>
              <h2 style={sectionTitleStyle}>いま優先したい教材</h2>
            </div>
            {currentBook?.books && <span style={tonePillStyle("in_progress")}>{statusLabel(currentBook.status)}</span>}
          </div>
          {currentBook?.books ? (
            <div style={focusCardStyle(currentBook.books.subject)}>
              <div style={{ display: "grid", gap: 10 }}>
                <p style={focusBookTitleStyle}>{currentBook.books.title}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span style={subjectPillStyle(currentBook.books.subject)}>{SUBJECT_LABEL[currentBook.books.subject] ?? currentBook.books.subject}</span>
                  <span style={softPillStyle}>Lv.{currentBook.books.level}</span>
                  <span style={softPillStyle}>約{currentBook.books.weeks_estimate}週間</span>
                  <span style={softPillStyle}>{currentBook.books.total_problems}問</span>
                </div>
              </div>
              <button onClick={() => router.push("/shelf")} style={primaryButtonStyle}>
                このまま演習へ進む
              </button>
            </div>
          ) : (
            <div style={emptyStateStyle}>進行中の教材はまだありません。ルートを見直すか、新しい教材を追加して始めましょう。</div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeadStyle}>
            <div>
              <p style={sectionEyebrowStyle}>Monthly View</p>
              <h2 style={sectionTitleStyle}>何月に何をやるかの全体図</h2>
            </div>
            <span style={softPillStyle}>月ごとの予定が分かります</span>
          </div>

          <div style={timelineWrapStyle}>
            <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${timelineMonths.length}, minmax(96px, 1fr))`, minWidth: 180 + timelineMonths.length * 96 }}>
              <div style={timelineCornerStyle}>科目 / 月</div>
              {timelineMonths.map((month) => (
                <div key={month.toISOString()} style={timelineMonthHeadStyle}>
                  {formatMonth(month)}
                </div>
              ))}

              {timelineGroups.map(({ subject, items }) => (
                <div key={`${subject}-row`} style={{ display: "contents" }}>
                  <div key={`${subject}-label`} style={timelineSubjectStyle(subject)}>
                    <div style={subjectIconStyle(subject)}>
                      {(() => {
                        const Icon = SUBJECT_ICONS[subject];
                        return <Icon size={15} color={SUBJECT_COLOR[subject]} strokeWidth={2.2} />;
                      })()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{SUBJECT_LABEL[subject]}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{items.length}冊</p>
                    </div>
                  </div>
                  <div key={`${subject}-track`} style={timelineTrackCellStyle}>
                    <div style={timelineTrackInnerStyle(timelineMonths.length)}>
                      {timelineMonths.map((month) => (
                        <div key={`${subject}-${month.toISOString()}`} style={timelineGridCellStyle} />
                      ))}
                      {items.map((item) => {
                        if (!item.books) return null;
                        const start = Math.max(0, diffInMonths(timelineMonths[0], item.planStart));
                        const end = Math.max(start, diffInMonths(timelineMonths[0], item.planEnd));
                        const tone = statusTone(item.status);
                        return (
                          <div
                            key={item.id}
                            style={timelineBarStyle(start, end - start + 1, subject, item.status)}
                            title={`${formatMonth(item.planStart)}〜${formatMonth(item.planEnd)}: ${item.books.title}`}
                          >
                            <span style={{ ...timelineBarStatusStyle, background: tone.bg, color: tone.text }}>{statusLabel(item.status)}</span>
                            <span style={timelineBarTitleStyle}>{item.books.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gap: 16 }}>
          {subjectGroups.map(({ subject, items }) => {
            const Icon = SUBJECT_ICONS[subject];
            const doneCount = items.filter((item) => item.status === "done" || item.status === "completed").length;
            const open = openSubjects[subject];

            return (
              <div key={subject} style={cardStyle}>
                <button
                  onClick={() => setOpenSubjects((prev) => ({ ...prev, [subject]: !prev[subject] }))}
                  style={subjectHeadButtonStyle}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={subjectIconStyle(subject)}>
                      <Icon size={16} color={SUBJECT_COLOR[subject]} strokeWidth={2.2} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={subjectTitleStyle}>{SUBJECT_LABEL[subject]}</p>
                      <p style={subjectSubStyle}>{doneCount} / {items.length}冊完了</p>
                    </div>
                  </div>
                  <div style={subjectRightMetaStyle}>
                    <span style={miniProgressPillStyle(subject)}>{Math.round((doneCount / items.length) * 100)}%</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{open ? "閉じる" : "見る"}</span>
                  </div>
                </button>

                {open && (
                  <div style={{ display: "grid", gap: 10 }}>
                    {items.map((item, index) => {
                      if (!item.books) return null;
                      return (
                        <div key={item.id} style={routeItemStyle(item.books.subject, item.status)}>
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <span style={routeOrderStyle}>{index + 1}</span>
                              <span style={tonePillStyle(item.status)}>{statusLabel(item.status)}</span>
                              {item.concurrent && <span style={softPillStyle}>同時進行</span>}
                            </div>
                            <p style={routeBookTitleStyle}>{item.books.title}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              <span style={softPillStyle}>約{item.books.weeks_estimate}週間</span>
                              <span style={softPillStyle}>{item.books.total_problems}問</span>
                              <span style={softPillStyle}>開始 {formatDate(item.started_at)}</span>
                              <span style={softPillStyle}>完了 {formatDate(item.completed_at)}</span>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                            {index > 0 && (
                              <button onClick={() => toggleConcurrent(item.id, item.concurrent)} style={secondaryButtonStyle}>
                                {item.concurrent ? "同時進行を外す" : "同時進行にする"}
                              </button>
                            )}
                            {item.status === "in_progress" && (
                              <button onClick={() => router.push("/shelf")} style={primaryButtonStyle}>
                                演習を続ける
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={statCardStyle}>
      <p style={statLabelStyle}>{label}</p>
      <p style={{ ...statValueStyle, color: accent }}>{value}</p>
      <p style={statSubStyle}>{sub}</p>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "24px 16px 88px",
  display: "grid",
  gap: 18,
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  padding: "24px 24px 20px",
  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.04)",
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent)",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0 8px",
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 800,
  color: "var(--text-primary)",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.8,
  color: "var(--text-secondary)",
  maxWidth: 720,
};

const heroMetaStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const metaPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const statCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 4,
};

const statLabelStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" };
const statValueStyle: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1 };
const statSubStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-secondary)" };

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 14,
};

const sectionHeadStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionEyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" };
const sectionTitleStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" };

const focusCardStyle = (subject: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "center",
  borderRadius: 18,
  padding: "18px 20px",
  background: `linear-gradient(135deg, ${SUBJECT_BG[subject] ?? "#F8FAFC"} 0%, #FFFFFF 100%)`,
  border: `1px solid ${SUBJECT_COLOR[subject] ?? "#D0D5DD"}22`,
});

const focusBookTitleStyle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" };

const subjectPillStyle = (subject: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: SUBJECT_BG[subject] ?? "var(--bg-elevated)",
  color: SUBJECT_COLOR[subject] ?? "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 700,
});

const softPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 700,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "28px 20px",
  borderRadius: 16,
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 14,
  lineHeight: 1.8,
};

const subjectHeadButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const subjectIconStyle = (subject: SubjectKey): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: SUBJECT_BG[subject],
});

const subjectTitleStyle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-primary)" };
const subjectSubStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" };
const subjectRightMetaStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

const miniProgressPillStyle = (subject: SubjectKey): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  background: SUBJECT_BG[subject],
  color: SUBJECT_COLOR[subject],
  fontSize: 12,
  fontWeight: 800,
});

const routeItemStyle = (subject: string, status: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  alignItems: "center",
  padding: "16px 18px",
  borderRadius: 18,
  border: `1px solid ${(SUBJECT_COLOR[subject] ?? "#D0D5DD") + "26"}`,
  background: status === "in_progress" ? `linear-gradient(135deg, ${SUBJECT_BG[subject] ?? "#F8FAFC"} 0%, #FFFFFF 100%)` : "#FFFFFF",
});

const routeOrderStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 800,
};

const routeBookTitleStyle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)" };

const tonePillStyle = (status: string): React.CSSProperties => {
  const tone = statusTone(status);
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    background: tone.bg,
    color: tone.text,
    border: `1px solid ${tone.border}`,
    fontSize: 11,
    fontWeight: 800,
  };
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, var(--accent), #5B73D4)",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const timelineWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: 18,
  border: "1px solid var(--border)",
  background: "#fff",
};

const timelineCornerStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  padding: "14px 16px",
  background: "var(--bg-elevated)",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-secondary)",
};

const timelineMonthHeadStyle: React.CSSProperties = {
  padding: "14px 8px",
  textAlign: "center",
  background: "var(--bg-elevated)",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-secondary)",
};

const timelineSubjectStyle = (_subject?: string): React.CSSProperties => ({
  position: "sticky",
  left: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "16px",
  borderRight: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  background: "#fff",
});

const timelineTrackCellStyle: React.CSSProperties = {
  gridColumn: "2 / -1",
  borderBottom: "1px solid var(--border)",
  background: "#fff",
  overflow: "hidden",
};

const timelineTrackInnerStyle = (count: number): React.CSSProperties => ({
  position: "relative",
  display: "grid",
  gridTemplateColumns: `repeat(${count}, minmax(96px, 1fr))`,
  minHeight: 82,
});

const timelineGridCellStyle: React.CSSProperties = {
  borderRight: "1px solid var(--border)",
};

const timelineBarStyle = (start: number, span: number, subject: SubjectKey, status: string): React.CSSProperties => ({
  position: "absolute",
  left: `calc(${start} * 96px + 6px)`,
  width: `calc(${span} * 96px - 12px)`,
  top: 12,
  minHeight: 58,
  borderRadius: 16,
  padding: "10px 12px",
  display: "grid",
  gap: 6,
  background:
    status === "in_progress"
      ? `linear-gradient(135deg, ${SUBJECT_BG[subject]} 0%, #FFFFFF 100%)`
      : status === "done" || status === "completed"
        ? "#F0FDF4"
        : "#F8FAFC",
  border: `1px solid ${(status === "done" || status === "completed") ? "#A6F4C5" : `${SUBJECT_COLOR[subject]}33`}`,
  boxShadow: status === "in_progress" ? "0 8px 24px rgba(49, 87, 183, 0.08)" : "none",
  overflow: "hidden",
});

const timelineBarStatusStyle: React.CSSProperties = {
  justifySelf: "start",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
};

const timelineBarTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-primary)",
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const loadingWrapStyle: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid var(--border)",
  borderTop: "3px solid var(--accent)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};
