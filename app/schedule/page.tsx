"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import Link from "next/link";

import AppLayout from "@/app/components/AppLayout";

import { refreshXpBar } from "@/app/components/XpBar";

import { SUBJECT_COLOR, SUBJECT_BG, SUBJECT_LABEL } from "@/lib/types";

import {

  ArrowRight,

  CalendarDays,

  CheckCircle2,

  Circle,

  Clock3,

  FileText,

  PencilLine,

  Plus,

  Sparkles,

  Target,

  Trash2,

  Trophy,

  X,

} from "lucide-react";

type StudyTask = {

  id: string;

  date: string;

  status: "pending" | "done" | "skipped";

  task_type: string;

  problem_no_start: number;

  problem_no_end: number;

  books: { title: string; subject: string } | null;

};

type WeekTaskGroup = {

  date: string;

  tasks: StudyTask[];

  done: number;

  total: number;

};

type FreeTask = {

  id: string;

  date: string | null;

  title: string;

  status: "pending" | "done";

  source: string;

  task_mode: "later" | "scheduled";

  category: TaskCategory;

  start_time: string | null;

  end_time: string | null;

  event_id: string | null;

};

type ActivityItem = {

  id: string;

  actor_name: string;

  feed_type: string;

  title: string;

  body: string | null;

  xp_delta: number;

  metadata: Record<string, unknown>;

  created_at: string;

  reaction_count: number;

  reacted: boolean;

};

type TaskCategory = "club" | "test" | "lesson" | "free" | "other";

type TaskMode = "later" | "scheduled";

type ScheduleResponse = {

  student: {

    name: string;

    target_univ: string | null;

    exam_date: string | null;

    plan?: string;

  };

  today: string;

  todayTasks: StudyTask[];

  weekTasks: WeekTaskGroup[];

  hasSchedule: boolean;

  isRepeatWeek: boolean;

  freeTasks: FreeTask[];

  laterTasks: FreeTask[];

  activityFeed: ActivityItem[];

  usage: {

    monthlyQuestionLimit: number | null;

    monthlyQuestionUsed: number;

    monthlyQuestionRemaining: number | null;

    weeklyQuestionUsed: number;

  };

  continuity: {

    currentStreak: number;

    longestStreak: number;

    activeDays: number;

    badges: Array<{

      id: string;

      label: string;

      description: string;

      emoji: string;

      unlocked: boolean;

    }>;

  };

  weeklyReview: {

    studyDays: number;

    completedStudyTasks: number;

    totalStudyTasks: number;

    completedTodos: number;

    summary: {

      title: string;

      body: string;

    };

  };

};

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string; color: string; bg: string }> = [

  { value: "club", label: "#部活", color: "#475569", bg: "#F7F7F5" },

  { value: "test", label: "#テスト", color: "#475569", bg: "#F7F7F5" },

  { value: "lesson", label: "#授業", color: "#475569", bg: "#F7F7F5" },

  { value: "free", label: "#自由", color: "#475569", bg: "#F7F7F5" },

  { value: "other", label: "#その他", color: "#64748B", bg: "#F7F7F5" },

];

const MODE_OPTIONS: Array<{ value: TaskMode; label: string; description: string }> = [

  { value: "scheduled", label: "予定に入れる", description: "日付や時間を決めてカレンダーにも入れる" },

  { value: "later", label: "あとでやる", description: "思いついたことを先に置いておく" },

];

const QUICK_LINKS = [

  { href: "/practice", label: "演習記録", description: "演習や勉強時間をすぐ残す", icon: PencilLine, accent: "#1E293B", bg: "#F7F7F5" },

  { href: "/progress", label: "成績管理", description: "模試と記録を見直す", icon: Trophy, accent: "#1E293B", bg: "#F7F7F5" },

  { href: "/my-sensei?mode=question", label: "質問する", description: "写真や文章ですぐ聞く", icon: Sparkles, accent: "#1E293B", bg: "#F7F7F5" },

  { href: "/mock-exams", label: "模試記録", description: "結果を残して比較する", icon: FileText, accent: "#1E293B", bg: "#F7F7F5" },

  { href: "/route", label: "学習ルート", description: "今日の学習順を確認する", icon: Target, accent: "#1E293B", bg: "#F7F7F5" },

  { href: "/events", label: "カレンダー", description: "予定と勉強時間を見る", icon: CalendarDays, accent: "#1E293B", bg: "#F7F7F5" },

] as const;

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateLabel(date: string | null) {

  if (!date) return "あとで";

  const value = new Date(`${date}T00:00:00`);

  return `${date.slice(5).replace("-", "/")}(${WEEKDAY_LABELS[value.getDay()]})`;

}

function formatTimeRange(start: string | null, end: string | null) {

  if (!start && !end) return "時間未設定";

  const startLabel = start ? start.slice(0, 5) : "--:--";

  const endLabel = end ? end.slice(0, 5) : "--:--";

  return `${startLabel} - ${endLabel}`;

}

function categoryConfig(category: TaskCategory) {

  return CATEGORY_OPTIONS.find((option) => option.value === category) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];

}

function subjectAccent(subject: string | undefined) {
  if (subject && SUBJECT_LABEL[subject]) {
    return {
      color: SUBJECT_COLOR[subject] ?? "#4B5563",
      bg: SUBJECT_BG[subject] ?? "#F3F4F6",
      label: SUBJECT_LABEL[subject],
    };
  }
  return { color: "#64748B", bg: "#F7F7F5", label: "学習" };
}

function formatRelativeTime(value: string) {

  const diff = Date.now() - new Date(value).getTime();

  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);

  return `${days}日前`;

}

function openSensei(query?: string) {

  if (typeof window === "undefined") return;

  window.location.href = query ? `/my-sensei?query=${encodeURIComponent(query)}` : "/my-sensei";

}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #E8E8E4",
  borderRadius: 18,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#0F172A",
};

export default function SchedulePage() {

  const [data, setData] = useState<ScheduleResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [showComposer, setShowComposer] = useState(false);

  const [mode, setMode] = useState<TaskMode>("scheduled");

  const [title, setTitle] = useState("");

  const [date, setDate] = useState("");

  const [startTime, setStartTime] = useState("");

  const [endTime, setEndTime] = useState("");

  const [category, setCategory] = useState<TaskCategory>("other");

  const loadSchedule = async () => {

    setLoading(true);

    const res = await fetch("/api/schedule", { cache: "no-store" });

    const json = (await res.json()) as ScheduleResponse;

    setData(json);

    setLoading(false);

  };

  useEffect(() => {

    const timer = window.setTimeout(() => {

      void loadSchedule();

    }, 0);

    return () => window.clearTimeout(timer);

  }, []);

  const todayScheduled = useMemo(() => {

    if (!data) return [];

    return data.freeTasks.filter((task) => task.date === data.today);

  }, [data]);

  const upcomingScheduled = useMemo(() => {

    if (!data) return [];

    return data.freeTasks.filter((task) => task.date !== data.today);

  }, [data]);

  const completedStudyCount = useMemo(

    () => data?.weekTasks.reduce((sum, day) => sum + day.done, 0) ?? 0,

    [data]

  );

  const totalStudyCount = useMemo(

    () => data?.weekTasks.reduce((sum, day) => sum + day.total, 0) ?? 0,

    [data]

  );

  const mySenseiPrompts = useMemo(() => {

    if (!data) return [];

    const nextStudyTask = data.todayTasks.find((task) => task.status !== "done");

    const hasActivity = data.activityFeed.length > 0;

    return [

      {

        label: "今日の優先順位を聞く",

        description: "今日の予定と学習タスクから、先にやる3つを整理してもらう。",

        query: `${data.student.name}の今日の予定Todoと学習タスクを見て、優先順位を3つに絞って提案して。`,

      },

      {

        label: "最近の流れを整理する",

        description: "最近の記録や動きから、強みと止まりやすい所を短くまとめてもらう。",

        query: hasActivity

          ? "最近の学習記録を見て、良い流れと見直したい所を短く整理して。"

          : "まだ学習記録が少ない状態です。最初に何から整えるべきか提案して。",

      },

      {

        label: "次の90分プランを作る",

        description: "今あるタスクや教材から、このあと進める90分の流れを作ってもらう。",

        query: nextStudyTask

          ? `${nextStudyTask.books?.title ?? "今日の学習"}を含めて、このあとの90分プランを作って。`

          : "このあとの90分で進める学習プランを作って。",

      },

      {

        label: "質問モードで聞く",

        description: "分からない問題やモヤモヤを、そのまま質問モードに持っていく。",

        query: "質問モードで、解き方と考え方を分かりやすく教えて。",

      },

    ];

  }, [data]);

  const resetComposer = () => {

    setMode("scheduled");

    setTitle("");

    setDate("");

    setStartTime("");

    setEndTime("");

    setCategory("other");

  };

  const createTask = async () => {

    if (!title.trim()) return;

    if (mode === "scheduled" && !date) return;

    setSaving(true);

    await fetch("/api/free-tasks", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        title: title.trim(),

        task_mode: mode,

        category,

        date: mode === "scheduled" ? date : null,

        start_time: mode === "scheduled" ? startTime || null : null,

        end_time: mode === "scheduled" ? endTime || null : null,

      }),

    });

    resetComposer();

    setShowComposer(false);

    setSaving(false);

    await loadSchedule();

  };

  const updateTaskStatus = async (task: FreeTask, nextStatus: "pending" | "done") => {

    await fetch("/api/free-tasks", {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ id: task.id, status: nextStatus }),

    });

    refreshXpBar();

    await loadSchedule();

  };

  const deleteTask = async (taskId: string) => {

    await fetch("/api/free-tasks", {

      method: "DELETE",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ id: taskId }),

    });

    await loadSchedule();

  };

  const toggleReaction = async (activityId: string) => {

    await fetch("/api/activity-feed/reactions", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ activityId, reaction: "cheer" }),

    });

    await loadSchedule();

  };

  if (loading || !data) {

    return (

      <AppLayout>

        <div style={{ minHeight: "100dvh", padding: "32px 16px", background: "var(--bg)" }}>

          <div style={{ ...cardStyle, maxWidth: 860, margin: "0 auto", padding: 24 }}>

            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>ホームを読み込み中...</p>

          </div>

        </div>

      </AppLayout>

    );

  }

  return (

    <AppLayout>

      <div style={{ minHeight: "100dvh", background: "transparent" }}>

        <main className="schedule-main">

          <section className="schedule-hero-grid">

            <TaskSection

              title="今日の予定Todo"

              subtitle="いま動くべき予定を上から確認できます。"

              tasks={todayScheduled}

              emptyText="今日の予定Todoはまだありません。右上の + から追加できます。"

              onToggle={updateTaskStatus}

              onDelete={deleteTask}

              showSchedule

              highlightColor="#F1F5F9"

            />

            <section style={{ ...cardStyle, padding: 14, background: "#fff", display: "grid", gap: 12, alignSelf: "start" }}>

              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>Today</div>

              <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.03em", color: "#0F172A" }}>{data.student.name}さん、おかえりなさい</div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                <span style={{ ...summaryPillStyle, background: "#EFF6FF", color: "#1D4ED8" }}>今日 {todayScheduled.length}</span>

                <span style={{ ...summaryPillStyle, background: "#F1F5F9", color: "#64748B" }}>あとで {data.laterTasks.length}</span>

                <span style={{ ...summaryPillStyle, background: "#DCFCE7", color: "#166534" }}>演習 {completedStudyCount}/{totalStudyCount}</span>

              </div>

              <div style={{ display: "grid", gap: 8 }}>

                <div style={{ borderRadius: 14, padding: "12px 13px", background: "#FAFAFA", border: "1px solid #E8E8E4" }}>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>

                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>AI質問の残り</span>

                    <span style={{ ...miniBadgeStyle, background: "#EFF6FF", color: "#1D4ED8" }}>

                      {data.usage.monthlyQuestionLimit == null ? "制限なし" : `残り ${data.usage.monthlyQuestionRemaining}回`}

                    </span>

                  </div>

                  <div style={{ fontSize: 12, color: "#64748B" }}>今月 {data.usage.monthlyQuestionUsed} / 今週 {data.usage.weeklyQuestionUsed}</div>

                </div>

                <div style={{ borderRadius: 14, padding: "12px 13px", background: "#FAFAFA", border: "1px solid #E8E8E4" }}>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>

                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>連続記録</span>

                    <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>{data.continuity.currentStreak > 0 ? `${data.continuity.currentStreak}日連続` : "今日から"}</span>

                  </div>

                  <div style={{ fontSize: 12, color: "#64748B" }}>最長 {data.continuity.longestStreak}日 / 活動日数 {data.continuity.activeDays}日</div>

                </div>

              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>

                {QUICK_LINKS.slice(0, 4).map((item) => {

                  const Icon = item.icon;

                  return (

                    <Link

                      key={item.href}

                      href={item.href}

                      style={{

                        display: "flex",

                        alignItems: "center",

                        gap: 8,

                        minWidth: 0,

                        borderRadius: 14,

                        padding: "11px 12px",

                        textDecoration: "none",

                        border: "1px solid #E8E8E4",

                        background: item.bg,

                      }}

                    >

                      <span style={{ ...hubIconStyle, width: 30, height: 30, borderRadius: 10, color: "#2563EB", background: "rgba(255,255,255,0.84)" }}>

                        <Icon size={15} />

                      </span>

                      <span style={{ minWidth: 0, fontSize: 12, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>

                    </Link>

                  );

                })}

              </div>

            </section>

          </section>

          <section className="schedule-lower-grid">

            <TaskSection

              title="あとでやる"

              subtitle="思いついたことを一度ここに置いて、あとから整えられます。"

              tasks={data.laterTasks}

              emptyText="あとでレーンは空です。気になったことをメモ代わりに追加できます。"

              onToggle={updateTaskStatus}

              onDelete={deleteTask}

              highlightColor="#F7F7F5"

            />

            <section style={{ ...cardStyle, padding: 20 }}>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>

                <div>

                  <h2 style={sectionTitleStyle}>今日の学習タスク</h2>

                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>自分で組まれた学習タスクを、そのまま確認できます。</p>

                </div>

                <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>{formatDateLabel(data.today)}</span>

              </div>

              <div style={{ display: "grid", gap: 10 }}>

                {data.todayTasks.length === 0 ? (

                  <EmptyState text="今日の学習タスクはまだありません。学習ルートや演習記録から次の一歩を決められます。" />

                ) : (

                  data.todayTasks.map((task) => {

                    const accent = subjectAccent(task.books?.subject);

                    return (

                      <article key={task.id} style={{ ...taskCardStyle(task.status === "done"), background: task.status === "done" ? "#FAFAFA" : "#fff" }}>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>

                          <div>

                            <span style={{ ...miniBadgeStyle, color: "#475569", background: "#F1F5F9" }}>{accent.label}</span>

                            <h3 style={{ margin: "10px 0 4px", fontSize: 15, color: "#0F172A" }}>{task.books?.title ?? "Study task"}</h3>

                            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>

                              {task.problem_no_start} - {task.problem_no_end} 問

                            </p>

                          </div>

                          <span style={{ ...miniBadgeStyle, color: task.status === "done" ? "#16A34A" : "#64748B", background: task.status === "done" ? "#DCFCE7" : "#F7F7F5" }}>

                            {task.status === "done" ? "完了" : "未完了"}

                          </span>

                        </div>

                      </article>

                    );

                  })

                )}

              </div>

            </section>

          </section>

          <section style={{ ...cardStyle, padding: 20, background: "#fff" }}>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>

              <div>

                <h2 style={sectionTitleStyle}>今週の振り返り</h2>

                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>

                  AIパートナーとして、今週どのくらい前に進めているかを短く確認できます。</p>

              </div>

              <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>

                {data.weeklyReview.studyDays}日学習</span>

            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>

              <MetricCard label="演習" value={`${data.weeklyReview.completedStudyTasks}/${data.weeklyReview.totalStudyTasks}`} note="学習タスク" compact />

              <MetricCard label="Todo" value={data.weeklyReview.completedTodos} note="完了タスク" compact />

              <MetricCard label="質問" value={data.usage.weeklyQuestionUsed} note="今週" compact />

            </div>

            <div style={{ borderRadius: 18, padding: 16, background: "#FAFAFA", border: "1px solid #E8E8E4" }}>

              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{data.weeklyReview.summary.title}</div>

              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.75, color: "#64748B" }}>

                {data.weeklyReview.summary.body}

              </p>

            </div>

            <div style={{ marginTop: 14 }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>

                <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>解放したバッジ</div>

                <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>

                  {data.continuity.badges.filter((badge) => badge.unlocked).length}個</span>

              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>

                {data.continuity.badges.map((badge) => (

                  <div

                    key={badge.id}

                    style={{

                      borderRadius: 18,

                      padding: 14,

                      border: badge.unlocked ? "1px solid rgba(37,99,235,0.3)" : "1px solid #E8E8E4",

                      background: badge.unlocked ? "#EFF6FF" : "#FAFAFA",

                      opacity: badge.unlocked ? 1 : 0.72,

                    }}

                  >

                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{badge.label}</div>

                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.65, color: "#64748B" }}>{badge.description}</div>

                  </div>

                ))}

              </div>

            </div>

          </section>

          <section style={{ ...cardStyle, padding: 16, background: "#fff" }}>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>

              <div>

                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>My Sensei</p>

                <h2 style={{ ...sectionTitleStyle, marginTop: 4 }}>自分のAI先生</h2>

              </div>

              <button

                onClick={() => openSensei()}

                style={{

                  border: "none",

                  borderRadius: 999,

                  background: "#2563EB",

                  color: "#fff",

                  padding: "9px 14px",

                  fontSize: 12,

                  fontWeight: 800,

                  cursor: "pointer",

                }}

              >

                My先生を開く

              </button>

            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>

              {mySenseiPrompts.map((prompt) => (

                <button

                  key={prompt.label}

                  onClick={() => openSensei(prompt.query)}

                  style={{

                    textAlign: "left",

                    borderRadius: 14,

                    padding: "12px 13px",

                    border: "1px solid #E8E8E4",

                    background: "#FAFAFA",

                    cursor: "pointer",

                  }}

                >

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>

                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{prompt.label}</div>

                    <ArrowRight size={15} color="#64748B" />

                  </div>

                  <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.55, color: "#64748B" }}>{prompt.description}</div>

                </button>

              ))}

            </div>

          </section>

          <section style={{ ...cardStyle, padding: 20, background: "#fff" }}>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>

              <div>

                <h2 style={sectionTitleStyle}>みんなの学習タイムライン</h2>

                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>自分や友達の積み上がりを、短く追える共有ログです。</p>

              </div>

              <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>shared feed</span>

            </div>

            <div style={{ display: "grid", gap: 10 }}>

              {data.activityFeed.length === 0 ? (

                <EmptyState text="まだタイムライン投稿はありません。Todo完了や演習記録をすると、ここに共有ログとして並びます。" />

              ) : (

                data.activityFeed.map((item) => (

                  <article key={item.id} style={{ ...taskCardStyle(false), background: "#FAFAFA" }}>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>

                      <div style={{ flex: 1, minWidth: 0 }}>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>

                          <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#64748B" }}>{item.actor_name}</span>

                          <span style={{ ...miniBadgeStyle, background: "#F1F5F9", color: "#1E293B" }}>

                            {item.xp_delta >= 0 ? `+${item.xp_delta}` : item.xp_delta} XP

                          </span>

                          <span style={{ fontSize: 12, color: "#94A3B8" }}>{formatRelativeTime(item.created_at)}</span>

                        </div>

                        <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A" }}>{item.title}</h3>

                        {item.body && (

                          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.65, color: "#64748B" }}>{item.body}</p>

                        )}

                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

                          <button

                            onClick={() => void toggleReaction(item.id)}

                            style={{

                              border: item.reacted ? "1px solid #2563EB" : "1px solid #E8E8E4",

                              borderRadius: 999,

                              background: item.reacted ? "#EFF6FF" : "#fff",

                              color: item.reacted ? "#2563EB" : "#64748B",

                              padding: "7px 12px",

                              fontSize: 12,

                              fontWeight: 800,

                              cursor: "pointer",

                              display: "inline-flex",

                              alignItems: "center",

                              gap: 6,

                            }}

                          >

                            <Sparkles size={14} />

                            応援する

                          </button>

                          <span style={{ fontSize: 12, color: "#94A3B8" }}>

                            {item.reaction_count}人が応援中

                          </span>

                        </div>

                      </div>

                    </div>

                  </article>

                ))

              )}

            </div>

          </section>

          <TaskSection

            title="今週の予定Todo"

            subtitle="今週の予定を先回りして確認できます。"

            tasks={upcomingScheduled}

            emptyText="今週の予定Todoはまだありません。"

            onToggle={updateTaskStatus}

            onDelete={deleteTask}

            showSchedule

            highlightColor="#F1F5F9"

          />

        </main>

        {showComposer && (

          <>

            <button

              onClick={() => {

                setShowComposer(false);

                resetComposer();

              }}

              aria-label="Close composer"

              style={{

                position: "fixed",

                inset: 0,

                border: "none",

                background: "rgba(15, 23, 42, 0.45)",

                backdropFilter: "blur(6px)",

                zIndex: 39,

              }}

            />

            <section

              style={{

                position: "fixed",

                left: "50%",

                bottom: 20,

                transform: "translateX(-50%)",

                width: "min(760px, calc(100vw - 24px))",

                zIndex: 40,

                ...cardStyle,

                background: "#FAFAFA",

                padding: 22,

              }}

            >

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>

                <div>

                  <h2 style={{ margin: 0, fontSize: 20, color: "#0F172A" }}>Todoを追加</h2>

                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>予定に入れるか、あとで用に置くかをここで選べます。</p>

                </div>

                <button

                  onClick={() => {

                    setShowComposer(false);

                    resetComposer();

                  }}

                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B", padding: 0 }}

                  aria-label="Close"

                >

                  <X size={20} />

                </button>

              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>

                {MODE_OPTIONS.map((option) => {

                  const active = mode === option.value;

                  return (

                    <button

                      key={option.value}

                      onClick={() => setMode(option.value)}

                      style={{

                        textAlign: "left",

                        padding: 14,

                        borderRadius: 18,

                        border: active ? "2px solid #2563EB" : "1px solid #E8E8E4",

                        background: active ? "#EFF6FF" : "#fff",

                        cursor: "pointer",

                      }}

                    >

                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{option.label}</div>

                      <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>{option.description}</div>

                    </button>

                  );

                })}

              </div>

              <div style={{ display: "grid", gap: 12 }}>

                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例: 英語テスト対策" style={inputStyle} />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

                  {CATEGORY_OPTIONS.map((option) => {

                    const active = category === option.value;

                    return (

                      <button

                        key={option.value}

                        onClick={() => setCategory(option.value)}

                        style={{

                          border: active ? `2px solid ${option.color}` : "1px solid #E8E8E4",

                          background: option.bg,

                          color: option.color,

                          borderRadius: 999,

                          padding: "8px 12px",

                          fontSize: 13,

                          fontWeight: 700,

                          cursor: "pointer",

                        }}

                      >

                        {option.label}

                      </button>

                    );

                  })}

                </div>

                {mode === "scheduled" && (

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>

                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />

                    <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} style={inputStyle} />

                    <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} style={inputStyle} />

                  </div>

                )}

                <button

                  onClick={() => void createTask()}

                  disabled={saving || !title.trim() || (mode === "scheduled" && !date)}

                  style={{

                    border: "none",

                    borderRadius: 16,

                    background: saving ? "#94A3B8" : "#2563EB",

                    color: "#FFFFFF",

                    padding: "15px 16px",

                    fontSize: 14,

                    fontWeight: 800,

                    cursor: saving ? "not-allowed" : "pointer",

                    display: "inline-flex",

                    alignItems: "center",

                    justifyContent: "center",

                    gap: 8,

                  }}

                >

                  <Plus size={16} />

                  {mode === "scheduled" ? "予定つきTodoを保存" : "あとでTodoを保存"}

                </button>

              </div>

            </section>

          </>

        )}

        <button

          onClick={() => setShowComposer(true)}

          style={{

            position: "fixed",

            right: 20,

            bottom: 24,

            zIndex: 38,

            border: "none",

            borderRadius: 999,

            background: "#2563EB",

            color: "#FFFFFF",

            padding: "14px 18px",

            fontSize: 14,

            fontWeight: 800,

            cursor: "pointer",

            display: "inline-flex",

            alignItems: "center",

            gap: 8,

            boxShadow: "0 16px 32px rgba(15, 23, 42, 0.28)",

          }}

        >

          <Plus size={16} />

          タスクを追加

        </button>

      </div>

    </AppLayout>

  );

}

function MetricCard({ label, value, note, compact = false }: { label: string; value: string | number; note: string; compact?: boolean }) {

  return (

    <div

      style={{

        borderRadius: compact ? 16 : 18,

        padding: compact ? 12 : 16,

        background: "#FAFAFA",

        border: compact ? "1px solid #E8E8E4" : "1px solid rgba(255,255,255,0.14)",

        backdropFilter: compact ? undefined : "blur(10px)",

        boxShadow: compact ? "inset 0 1px 0 rgba(255,255,255,0.75)" : undefined,

      }}

    >

      <div style={{ fontSize: 12, opacity: compact ? 1 : 0.72, color: compact ? "#64748B" : undefined }}>{label}</div>

      <div style={{ marginTop: 4, fontSize: compact ? 22 : 28, fontWeight: 800, color: compact ? "#0F172A" : undefined }}>{value}</div>

      <div style={{ marginTop: 4, fontSize: 11, opacity: compact ? 1 : 0.76, color: compact ? "#94A3B8" : undefined }}>{note}</div>

    </div>

  );

}

function TaskSection({

  title,

  subtitle,

  tasks,

  emptyText,

  onToggle,

  onDelete,

  showSchedule = false,

  highlightColor,

}: {

  title: string;

  subtitle: string;

  tasks: FreeTask[];

  emptyText: string;

  onToggle: (task: FreeTask, nextStatus: "pending" | "done") => Promise<void>;

  onDelete: (taskId: string) => Promise<void>;

  showSchedule?: boolean;

  highlightColor: string;

}) {

  return (

    <section style={{ ...cardStyle, padding: 20, background: "#fff" }}>

      <div style={{ marginBottom: 14 }}>

        <h2 style={sectionTitleStyle}>{title}</h2>

        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>{subtitle}</p>

      </div>

      <div style={{ display: "grid", gap: 10 }}>

        {tasks.length === 0 ? (

          <EmptyState text={emptyText} />

        ) : (

          tasks.map((task) => {

            const category = categoryConfig(task.category);

            const isDone = task.status === "done";

            return (

              <article key={task.id} style={taskCardStyle(isDone)}>

                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

                  <button

                    onClick={() => void onToggle(task, isDone ? "pending" : "done")}

                    style={{

                      border: "none",

                      background: "transparent",

                      padding: 0,

                      cursor: "pointer",

                      color: isDone ? "#16A34A" : "#CBD5E1",

                      marginTop: 1,

                    }}

                    aria-label={isDone ? "Mark as pending" : "Mark as done"}

                  >

                    {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}

                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>

                      <span style={{ ...miniBadgeStyle, color: category.color, background: category.bg }}>{category.label}</span>

                      {showSchedule && task.date && (

                        <span style={{ ...miniBadgeStyle, color: "#475569", background: "#F1F5F9" }}>{formatDateLabel(task.date)}</span>

                      )}

                    </div>

                    <h3 style={{ margin: 0, fontSize: 15, textDecoration: isDone ? "line-through" : "none", color: isDone ? "#94A3B8" : "#0F172A" }}>

                      {task.title}

                    </h3>

                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748B" }}>

                      {task.task_mode === "scheduled" ? (

                        <>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>

                            <Clock3 size={14} />

                            {formatTimeRange(task.start_time, task.end_time)}

                          </span>

                          <span>calendar sync</span>

                        </>

                      ) : (

                        <span>backlog</span>

                      )}

                    </div>

                  </div>

                  <button

                    onClick={() => void onDelete(task.id)}

                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8", padding: 0 }}

                    aria-label="Delete task"

                  >

                    <Trash2 size={18} />

                  </button>

                </div>

              </article>

            );

          })

        )}

      </div>

    </section>

  );

}

function EmptyState({ text }: { text: string }) {

  return (

    <div style={{ borderRadius: 18, border: "1px dashed #E2E2DE", background: "rgba(255,255,255,0.8)", padding: 18, fontSize: 13, lineHeight: 1.7, color: "#64748B" }}>

      {text}

    </div>

  );

}

const inputStyle: CSSProperties = {

  width: "100%",

  borderRadius: 16,

  border: "1px solid #E8E8E4",

  background: "#FFFFFF",

  padding: "13px 14px",

  fontSize: 14,

  color: "#0F172A",

};

const miniBadgeStyle: CSSProperties = {

  display: "inline-flex",

  alignItems: "center",

  borderRadius: 999,

  padding: "5px 10px",

  fontSize: 12,

  fontWeight: 700,

};

const hubIconStyle: CSSProperties = {

  width: 36,

  height: 36,

  borderRadius: 12,

  display: "inline-flex",

  alignItems: "center",

  justifyContent: "center",

  flexShrink: 0,

};

const summaryPillStyle: CSSProperties = {

  display: "inline-flex",

  alignItems: "center",

  borderRadius: 999,

  padding: "8px 12px",

  fontSize: 13,

  fontWeight: 800,

};

function taskCardStyle(done: boolean): CSSProperties {

  return {

    borderRadius: 20,

    border: "1px solid #E8E8E4",

    background: done ? "rgba(248, 250, 252, 0.92)" : "#fff",

    padding: 16,

    opacity: done ? 0.85 : 1,

  };

}

