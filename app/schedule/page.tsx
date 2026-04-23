"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { refreshXpBar } from "@/app/components/XpBar";
import { SUBJECT_COLOR, SUBJECT_BG, SUBJECT_LABEL } from "@/lib/types";
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, Circle, Clock3, Flame,
  LineChart, MessageSquareText, Plus, Route, Sparkles, Timer, Trash2, Trophy, X,
} from "lucide-react";

// ── 型定義 ────────────────────────────────────────────────────────
type StudyTask = {
  id: string; date: string; status: "pending" | "done" | "skipped";
  task_type: string; problem_no_start: number; problem_no_end: number;
  books: { title: string; subject: string } | null;
};
type WeekTaskGroup = { date: string; tasks: StudyTask[]; done: number; total: number };
type FreeTask = {
  id: string; date: string | null; title: string; status: "pending" | "done";
  source: string; task_mode: "later" | "scheduled"; category: TaskCategory;
  start_time: string | null; end_time: string | null; event_id: string | null;
};
type ActivityItem = {
  id: string; actor_name: string; feed_type: string; title: string; body: string | null;
  xp_delta: number; metadata: Record<string, unknown>; created_at: string;
  reaction_count: number; reacted: boolean;
};
type TaskCategory = "club" | "test" | "lesson" | "free" | "other";
type TaskMode = "later" | "scheduled";
type ScheduleResponse = {
  student: { name: string; target_univ: string | null; exam_date: string | null; plan?: string };
  today: string;
  todayTasks: StudyTask[];
  upcomingStudyTasks: StudyTask[];
  weekTasks: WeekTaskGroup[];
  hasSchedule: boolean; isRepeatWeek: boolean;
  freeTasks: FreeTask[]; laterTasks: FreeTask[];
  activityFeed: ActivityItem[];
  homeMessage: string;
  thisMonthStudyMinutes: number;
  usage: {
    monthlyQuestionLimit: number | null; monthlyQuestionUsed: number;
    monthlyQuestionRemaining: number | null; weeklyQuestionUsed: number;
  };
  continuity: {
    currentStreak: number; longestStreak: number; activeDays: number;
    badges: Array<{ id: string; label: string; description: string; emoji: string; unlocked: boolean }>;
  };
  weeklyReview: {
    studyDays: number; completedStudyTasks: number; totalStudyTasks: number;
    completedTodos: number; summary: { title: string; body: string };
  };
};

// ── 定数 ────────────────────────────────────────────────────────
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
const QUICK_ACCESS = [
  { href: "/my-sensei?mode=question", label: "質問する", Icon: MessageSquareText, bg: "#EFF6FF", color: "#2563EB" },
  { href: "/shelf", label: "本棚", Icon: BookOpen, bg: "#F0FDF4", color: "#16A34A" },
  { href: "/reflection", label: "振り返り", Icon: LineChart, bg: "#FFF7ED", color: "#EA580C" },
  { href: "/progress", label: "課題・履歴", Icon: Trophy, bg: "#FDF4FF", color: "#9333EA" },
  { href: "/events", label: "カレンダー", Icon: CalendarDays, bg: "#F0FDFA", color: "#0F766E" },
  { href: "/route", label: "学習ルート", Icon: Route, bg: "#F8FAFC", color: "#475569" },
] as const;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// ── ヘルパー ─────────────────────────────────────────────────────
function formatDateLabel(date: string | null) {
  if (!date) return "あとで";
  const v = new Date(`${date}T00:00:00`);
  return `${date.slice(5).replace("-", "/")}(${WEEKDAY_LABELS[v.getDay()]})`;
}
function formatTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  return `${start ? start.slice(0, 5) : "--:--"}–${end ? end.slice(0, 5) : "--:--"}`;
}
function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function formatStudyMinutes(total: number): string {
  if (!total || total <= 0) return "0分";
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? (m > 0 ? `${h}時間${m}分` : `${h}時間`) : `${m}分`;
}
function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
function categoryConfig(cat: TaskCategory) {
  return CATEGORY_OPTIONS.find(o => o.value === cat) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
}
function subjectAccent(subject?: string) {
  if (subject && SUBJECT_LABEL[subject]) {
    return { color: SUBJECT_COLOR[subject] ?? "#4B5563", bg: SUBJECT_BG[subject] ?? "#F3F4F6", label: SUBJECT_LABEL[subject] };
  }
  return { color: "#64748B", bg: "#F7F7F5", label: "学習" };
}
function openSensei(query?: string) {
  if (typeof window === "undefined") return;
  window.location.href = query ? `/my-sensei?query=${encodeURIComponent(query)}` : "/my-sensei";
}

// ── メインコンポーネント ─────────────────────────────────────────
export default function SchedulePage() {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // composer
  const [showComposer, setShowComposer] = useState(false);
  const [mode, setMode] = useState<TaskMode>("scheduled");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<TaskCategory>("other");

  // timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerStartMs, setTimerStartMs] = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerNote, setTimerNote] = useState("");
  const [timerSaving, setTimerSaving] = useState(false);

  const loadSchedule = async () => {
    setLoading(true);
    const res = await fetch("/api/schedule", { cache: "no-store" });
    setData(await res.json() as ScheduleResponse);
    setLoading(false);
  };

  useEffect(() => { void loadSchedule(); }, []);

  // タイマーをlocalStorageから復元
  useEffect(() => {
    const stored = localStorage.getItem("activeTimer");
    if (stored) {
      try {
        const { startMs, note } = JSON.parse(stored) as { startMs: number; note: string };
        setTimerStartMs(startMs);
        setTimerNote(note ?? "");
        setTimerActive(true);
        setTimerElapsed(Math.floor((Date.now() - startMs) / 1000));
      } catch { /* ignore */ }
    }
  }, []);

  // タイマー更新
  useEffect(() => {
    if (!timerActive || timerStartMs == null) return;
    const id = setInterval(() => setTimerElapsed(Math.floor((Date.now() - timerStartMs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [timerActive, timerStartMs]);

  const startTimer = () => {
    const startMs = Date.now();
    setTimerStartMs(startMs);
    setTimerActive(true);
    setTimerElapsed(0);
    localStorage.setItem("activeTimer", JSON.stringify({ startMs, note: "" }));
  };

  const stopTimer = async () => {
    if (timerSaving) return;
    localStorage.removeItem("activeTimer");
    setTimerActive(false);
    const minutes = Math.max(1, Math.floor(timerElapsed / 60));
    setTimerSaving(true);
    await fetch("/api/practice-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyMinutes: minutes, title: timerNote || null, endedAt: new Date().toISOString() }),
    });
    setTimerSaving(false);
    setTimerNote("");
    setTimerStartMs(null);
    setTimerElapsed(0);
    refreshXpBar();
    await loadSchedule();
  };

  const updateTimerNote = (note: string) => {
    setTimerNote(note);
    if (timerActive && timerStartMs != null) {
      localStorage.setItem("activeTimer", JSON.stringify({ startMs: timerStartMs, note }));
    }
  };

  const resetComposer = () => { setMode("scheduled"); setTitle(""); setDate(""); setStartTime(""); setEndTime(""); setCategory("other"); };

  const createTask = async () => {
    if (!title.trim() || (mode === "scheduled" && !date)) return;
    setSaving(true);
    await fetch("/api/free-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), task_mode: mode, category, date: mode === "scheduled" ? date : null, start_time: mode === "scheduled" ? startTime || null : null, end_time: mode === "scheduled" ? endTime || null : null }),
    });
    resetComposer(); setShowComposer(false); setSaving(false);
    await loadSchedule();
  };

  const updateTaskStatus = async (task: FreeTask, nextStatus: "pending" | "done") => {
    await fetch("/api/free-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, status: nextStatus }) });
    refreshXpBar();
    await loadSchedule();
  };

  const deleteTask = async (taskId: string) => {
    await fetch("/api/free-tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId }) });
    await loadSchedule();
  };

  const toggleReaction = async (activityId: string) => {
    await fetch("/api/activity-feed/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, reaction: "cheer" }) });
    await loadSchedule();
  };

  // 派生データ
  const todayScheduled = useMemo(() => data?.freeTasks.filter(t => t.date === data.today) ?? [], [data]);
  const upcomingScheduled = useMemo(() => data?.freeTasks.filter(t => t.date !== data?.today) ?? [], [data]);
  const todayStudyDone = useMemo(() => data?.todayTasks.filter(t => t.status === "done").length ?? 0, [data]);

  const examDaysLeft = useMemo(() => {
    if (!data?.student.exam_date) return null;
    const days = Math.ceil((new Date(data.student.exam_date).getTime() - Date.now()) / 86400000);
    return days > 0 ? days : null;
  }, [data]);

  const mySenseiPrompts = useMemo(() => {
    if (!data) return [];
    const next = data.todayTasks.find(t => t.status !== "done");
    const hasActivity = data.activityFeed.length > 0;
    return [
      { label: "今日の優先順位を聞く", description: "今日の予定と学習タスクから、先にやる3つを整理してもらう。", query: `${data.student.name}の今日の予定Todoと学習タスクを見て、優先順位を3つに絞って提案して。` },
      { label: "最近の流れを整理する", description: "最近の記録や動きから、強みと止まりやすい所を短くまとめてもらう。", query: hasActivity ? "最近の学習記録を見て、良い流れと見直したい所を短く整理して。" : "まだ学習記録が少ない状態です。最初に何から整えるべきか提案して。" },
      { label: "90分プランを作る", description: "このあとの90分で進める学習プランを作ってもらう。", query: next ? `${next.books?.title ?? "今日の学習"}を含めて、このあとの90分プランを作って。` : "このあとの90分で進める学習プランを作って。" },
    ];
  }, [data]);

  if (loading || !data) {
    return (
      <AppLayout>
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  // 今日のタスク（study + free を統合表示用に整形）
  const todayAllCount = todayScheduled.length + data.todayTasks.length;
  const todayDoneCount = todayScheduled.filter(t => t.status === "done").length + todayStudyDone;

  // 今後のタスク: 日付順
  const upcomingItems: Array<{ date: string; label: string; subject?: string; color?: string; bg?: string }> = [
    ...upcomingScheduled.filter(t => t.date).map(t => ({ date: t.date!, label: t.title, color: "#475569", bg: "#F1F5F9" })),
    ...(data.upcomingStudyTasks ?? []).map(t => {
      const a = subjectAccent(t.books?.subject);
      return { date: t.date, label: t.books?.title ?? "学習タスク", subject: a.label, color: a.color, bg: a.bg };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>

          {/* ── 1. 入試カウントダウン + AI一言 ── */}
          <div style={heroCardStyle}>
            {examDaysLeft !== null && (
              <div style={countdownRowStyle}>
                <Flame size={13} color="#EA580C" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>受験まで</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{examDaysLeft}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>日</span>
                {data.student.target_univ && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{data.student.target_univ}</span>
                )}
              </div>
            )}
            <div style={greetingStyle}>"{data.homeMessage}"</div>
          </div>

          {/* ── 2. タイマーバナー (起動中のみ) ── */}
          {timerActive && (
            <div style={timerBannerStyle}>
              <Timer size={18} color="#2563EB" />
              <span style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", fontVariantNumeric: "tabular-nums", minWidth: 68 }}>{formatTimer(timerElapsed)}</span>
              <input
                value={timerNote}
                onChange={e => updateTimerNote(e.target.value)}
                placeholder="何を勉強してる？"
                style={timerInputStyle}
              />
              <button onClick={() => void stopTimer()} disabled={timerSaving} style={stopBtnStyle}>
                {timerSaving ? "保存中..." : "記録して終わる"}
              </button>
            </div>
          )}

          {/* ── 3. 今日・今後のタスク ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={sectionTitleStyle}>今日・今後のタスク</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94A3B8" }}>
                  今日 {todayDoneCount}/{todayAllCount} 完了
                </p>
              </div>
              <button onClick={() => setShowComposer(true)} style={addBtnStyle}>
                <Plus size={13} /> 追加
              </button>
            </div>

            {/* 今日の free tasks */}
            {todayScheduled.map(task => {
              const cat = categoryConfig(task.category);
              const done = task.status === "done";
              const timeRange = formatTimeRange(task.start_time, task.end_time);
              return (
                <div key={task.id} style={taskRowStyle(done)}>
                  <button onClick={() => void updateTaskStatus(task, done ? "pending" : "done")} style={checkBtnStyle(done)}>
                    {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ ...pillStyle(cat.bg, cat.color) }}>{cat.label}</span>
                      {timeRange && <span style={{ fontSize: 11, color: "#94A3B8" }}>{timeRange}</span>}
                    </div>
                  </div>
                  <button onClick={() => void deleteTask(task.id)} style={deleteBtnStyle}><Trash2 size={14} /></button>
                </div>
              );
            })}

            {/* 今日の study tasks */}
            {data.todayTasks.map(task => {
              const a = subjectAccent(task.books?.subject);
              const done = task.status === "done";
              return (
                <div key={task.id} style={taskRowStyle(done)}>
                  <div style={{ ...checkBtnStyle(done), cursor: "default" }}>
                    {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.books?.title ?? "学習タスク"}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                      <span style={{ ...pillStyle(a.bg, a.color) }}>{a.label}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{task.problem_no_start}–{task.problem_no_end}問</span>
                    </div>
                  </div>
                  <span style={{ ...pillStyle(done ? "#DCFCE7" : "#F1F5F9", done ? "#16A34A" : "#64748B") }}>{done ? "完了" : "未"}</span>
                </div>
              );
            })}

            {todayAllCount === 0 && (
              <div style={emptyTaskStyle}>今日のタスクはまだありません。上の「追加」から加えられます。</div>
            )}

            {/* ─ 今後 ─ */}
            {upcomingItems.length > 0 && (
              <>
                <div style={upcomingDividerStyle}>
                  <div style={dividerLineStyle} />
                  <span style={dividerLabelStyle}>今後</span>
                  <div style={dividerLineStyle} />
                </div>
                {upcomingItems.map((item, i) => (
                  <div key={i} style={upcomingRowStyle}>
                    <span style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", width: 52 }}>{formatDateLabel(item.date)}</span>
                    <span style={{ ...pillStyle(item.bg ?? "#F1F5F9", item.color ?? "#64748B"), fontSize: 10 }}>{item.subject ?? "#"}</span>
                    <span style={{ fontSize: 13, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── 4. 勉強を記録 ── */}
          {!timerActive && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={startTimer} style={primaryActionBtnStyle}>
                <Clock3 size={17} /> タイマーを起動
              </button>
              <Link href="/shelf" style={secondaryActionBtnStyle}>
                <BookOpen size={17} /> 本棚から始める
              </Link>
            </div>
          )}

          {/* ── 5. ステータス行 ── */}
          <div style={statusRowStyle}>
            <StatusPill icon={<Flame size={13} color="#EA580C" />} value={`${data.continuity.currentStreak}日`} label="連続" />
            <StatusPill icon={<Clock3 size={13} color="#2563EB" />} value={formatStudyMinutes(data.thisMonthStudyMinutes)} label="今月" />
            <StatusPill icon={<CalendarDays size={13} color="#0F766E" />} value={`${data.weeklyReview.studyDays}日`} label="今週" />
            <StatusPill icon={<MessageSquareText size={13} color="#7C3AED" />} value={data.usage.monthlyQuestionRemaining == null ? "∞" : `${data.usage.monthlyQuestionRemaining}`} label="AI残り" />
          </div>

          {/* ── 6. クイックアクセス ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {QUICK_ACCESS.map(({ href, label, Icon, bg, color }) => (
              <Link key={href} href={href} style={{ ...quickTileStyle, background: bg }}>
                <Icon size={22} color={color} />
                <span style={{ fontSize: 11, fontWeight: 800, color, marginTop: 6 }}>{label}</span>
              </Link>
            ))}
          </div>

          {/* ── 7. 今週のサマリー ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={sectionTitleStyle}>今週の振り返り</h2>
              <span style={pillStyle("#F1F5F9", "#64748B")}>{data.weeklyReview.studyDays}日学習</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <MiniMetric label="演習" value={`${data.weeklyReview.completedStudyTasks}/${data.weeklyReview.totalStudyTasks}`} note="学習タスク" />
              <MiniMetric label="Todo" value={data.weeklyReview.completedTodos} note="完了タスク" />
              <MiniMetric label="質問" value={data.usage.weeklyQuestionUsed} note="今週" />
            </div>
            <div style={summaryBoxStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>{data.weeklyReview.summary.title}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: "#64748B" }}>{data.weeklyReview.summary.body}</p>
            </div>
          </div>

          {/* ── 8. My先生ショートカット ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={sectionTitleStyle}>My先生に相談する</h2>
              <button onClick={() => openSensei()} style={openSenseiBtnStyle}>My先生を開く</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {mySenseiPrompts.map(p => (
                <button key={p.label} onClick={() => openSensei(p.query)} style={senseiPromptStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{p.label}</span>
                    <ArrowRight size={13} color="#94A3B8" />
                  </div>
                  <span style={{ fontSize: 11, lineHeight: 1.55, color: "#64748B" }}>{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 9. タイムライン ── */}
          {data.activityFeed.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={sectionTitleStyle}>みんなのタイムライン</h2>
                <span style={pillStyle("#F1F5F9", "#64748B")}>shared feed</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {data.activityFeed.map(item => (
                  <div key={item.id} style={feedItemStyle}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={pillStyle("#F1F5F9", "#64748B")}>{item.actor_name}</span>
                      <span style={pillStyle("#F1F5F9", "#1E293B")}>{item.xp_delta >= 0 ? `+${item.xp_delta}` : item.xp_delta} XP</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{formatRelativeTime(item.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{item.title}</div>
                    {item.body && <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.65, color: "#64748B" }}>{item.body}</p>}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => void toggleReaction(item.id)} style={{ ...pillStyle(item.reacted ? "#EFF6FF" : "#fff", item.reacted ? "#2563EB" : "#64748B"), border: `1px solid ${item.reacted ? "#2563EB" : "#E8E8E4"}`, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Sparkles size={12} /> 応援する
                      </button>
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{item.reaction_count}人が応援中</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 10. あとでやる (件数があれば表示) ── */}
          {data.laterTasks.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={sectionTitleStyle}>あとでやる</h2>
                <span style={pillStyle("#F1F5F9", "#64748B")}>{data.laterTasks.length}件</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {data.laterTasks.map(task => {
                  const done = task.status === "done";
                  return (
                    <div key={task.id} style={taskRowStyle(done)}>
                      <button onClick={() => void updateTaskStatus(task, done ? "pending" : "done")} style={checkBtnStyle(done)}>
                        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none" }}>{task.title}</span>
                      <button onClick={() => void deleteTask(task.id)} style={deleteBtnStyle}><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Composer オーバーレイ ── */}
      {showComposer && (
        <>
          <button onClick={() => { setShowComposer(false); resetComposer(); }} style={overlayStyle} aria-label="Close" />
          <section style={composerStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0F172A" }}>Todoを追加</h2>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B" }}>予定に入れるか、あとで用に置くかをここで選べます。</p>
              </div>
              <button onClick={() => { setShowComposer(false); resetComposer(); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B", padding: 0 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {MODE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setMode(opt.value)} style={{ textAlign: "left", padding: 14, borderRadius: 18, border: mode === opt.value ? "2px solid #2563EB" : "1px solid #E8E8E4", background: mode === opt.value ? "#EFF6FF" : "#fff", cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{opt.label}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>{opt.description}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 英語テスト対策" style={inputStyle} autoFocus />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORY_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setCategory(opt.value)} style={{ border: category === opt.value ? `2px solid ${opt.color}` : "1px solid #E8E8E4", background: opt.bg, color: opt.color, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {mode === "scheduled" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
                </div>
              )}
              <button onClick={() => void createTask()} disabled={saving || !title.trim() || (mode === "scheduled" && !date)} style={composerSubmitStyle(saving || !title.trim() || (mode === "scheduled" && !date))}>
                <Plus size={16} /> {mode === "scheduled" ? "予定つきTodoを保存" : "あとでTodoを保存"}
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── FAB: タスク追加 ── */}
      {!showComposer && (
        <button onClick={() => setShowComposer(true)} style={fabStyle}>
          <Plus size={16} /> タスクを追加
        </button>
      )}
    </AppLayout>
  );
}

// ── サブコンポーネント ─────────────────────────────────────────
function StatusPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ flex: 1, borderRadius: 16, background: "#fff", border: "1px solid #E8E8E4", padding: "10px 8px", display: "grid", placeItems: "center", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>{label}</div>
    </div>
  );
}
function MiniMetric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div style={{ borderRadius: 14, padding: 12, background: "#FAFAFA", border: "1px solid #E8E8E4" }}>
      <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 10, color: "#94A3B8" }}>{note}</div>
    </div>
  );
}

// ── スタイル ─────────────────────────────────────────────────────
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const mainStyle: CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "16px 14px 100px", display: "grid", gap: 12 };
const spinnerStyle: CSSProperties = { width: 32, height: 32, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "#2563EB", animation: "spin 0.9s linear infinite" };
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #E8E8E4", borderRadius: 20, padding: "16px 16px" };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" };

// Hero
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)", borderRadius: 20, padding: "18px 20px", display: "grid", gap: 10 };
const countdownRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const greetingStyle: CSSProperties = { fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.88)", lineHeight: 1.6, fontStyle: "italic" };

// Timer banner
const timerBannerStyle: CSSProperties = { background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
const timerInputStyle: CSSProperties = { flex: 1, minWidth: 120, border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#0F172A", background: "#fff", outline: "none" };
const stopBtnStyle: CSSProperties = { border: "none", borderRadius: 10, background: "#2563EB", color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };

// Task rows
function taskRowStyle(done: boolean): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: "1px solid #F1F5F9", opacity: done ? 0.75 : 1 };
}
function checkBtnStyle(done: boolean): CSSProperties {
  return { border: "none", background: "transparent", padding: 0, cursor: "pointer", color: done ? "#16A34A" : "#CBD5E1", flexShrink: 0, display: "flex" };
}
const deleteBtnStyle: CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", padding: 0, flexShrink: 0, display: "flex" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "none", borderRadius: 10, background: "#2563EB", color: "#fff", padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const emptyTaskStyle: CSSProperties = { padding: "18px 0", fontSize: 13, color: "#94A3B8", textAlign: "center" };

// Upcoming divider
const upcomingDividerStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, margin: "12px 0 10px" };
const dividerLineStyle: CSSProperties = { flex: 1, height: 1, background: "#E8E8E4" };
const dividerLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 800, color: "#94A3B8", whiteSpace: "nowrap" };
const upcomingRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px solid #F8FAFC" };

// Pill helper
function pillStyle(bg: string, color: string): CSSProperties {
  return { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700, background: bg, color };
}

// Actions
const primaryActionBtnStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 16, background: "#0F172A", color: "#fff", padding: "15px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const secondaryActionBtnStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, border: "1px solid #E8E8E4", background: "#fff", color: "#0F172A", padding: "15px 0", fontSize: 14, fontWeight: 800, textDecoration: "none" };

// Status row
const statusRowStyle: CSSProperties = { display: "flex", gap: 8 };

// Quick access
const quickTileStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 18, padding: "16px 8px", textDecoration: "none", border: "1px solid rgba(148,163,184,0.12)" };

// Summary
const summaryBoxStyle: CSSProperties = { borderRadius: 16, padding: 14, background: "#FAFAFA", border: "1px solid #E8E8E4" };

// My先生
const openSenseiBtnStyle: CSSProperties = { border: "none", borderRadius: 999, background: "#2563EB", color: "#fff", padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const senseiPromptStyle: CSSProperties = { textAlign: "left", borderRadius: 14, padding: "12px 13px", border: "1px solid #E8E8E4", background: "#FAFAFA", cursor: "pointer" };

// Feed
const feedItemStyle: CSSProperties = { padding: "12px 14px", borderRadius: 16, background: "#FAFAFA", border: "1px solid #E8E8E4" };

// Composer
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, border: "none", background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 39, cursor: "default" };
const composerStyle: CSSProperties = { position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", width: "min(720px, calc(100vw - 24px))", zIndex: 40, background: "#FAFAFA", borderRadius: 24, padding: "22px 20px", maxHeight: "90dvh", overflowY: "auto", border: "1px solid #E8E8E4", boxShadow: "0 24px 48px rgba(15,23,42,0.18)" };
const inputStyle: CSSProperties = { width: "100%", borderRadius: 14, border: "1px solid #E8E8E4", background: "#fff", padding: "13px 14px", fontSize: 14, color: "#0F172A", boxSizing: "border-box", outline: "none" };
const composerSubmitStyle = (disabled: boolean): CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 14, background: disabled ? "#E2E8F0" : "#2563EB", color: disabled ? "#94A3B8" : "#fff", padding: "14px", fontSize: 14, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", width: "100%" });

// FAB
const fabStyle: CSSProperties = { position: "fixed", right: 20, bottom: 24, zIndex: 38, border: "none", borderRadius: 999, background: "#2563EB", color: "#fff", padding: "14px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 16px 32px rgba(15,23,42,0.28)" };
