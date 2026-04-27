"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Plus, Sparkles, BookOpen, X } from "lucide-react";

type TodoItem = {
  id: string; title: string; category: "task" | "review";
  status: "pending" | "done"; source: string; created_at: string;
};
type ReviewRecord = {
  id: string; material: string | null; range: string | null;
  subject: string | null; date: string; book_id: string | null;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const touchStartX = useRef<number | null>(null);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const isCurrentWeek = weekOffset === 0;
  const weekCardRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  // passive:false で縦スクロールを抑制しながら横スワイプを検知
  useEffect(() => {
    const el = weekCardRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault(); // カレンダー上では縦スクロールを常に無効化
    };
    const onEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 48) setWeekOffset(o => o + (diff > 0 ? 1 : -1));
      touchStartX.current = null;
      touchStartY.current = null;
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/todos").then(r => r.ok ? r.json() : { todos: [] }),
      fetch("/api/todos/review-records").then(r => r.ok ? r.json() : { records: [] }),
    ]).then(([td, rv]) => {
      // category マッピング: today/other → task
      const mapped = (td.todos ?? []).map((t: TodoItem & { category: string }) => ({
        ...t,
        category: t.category === "review" ? "review" : "task",
      })) as TodoItem[];
      setItems(mapped);
      setReviewRecords(rv.records ?? []);
    }).finally(() => setLoading(false));
  }, []);

  function openInput() {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function addTodo() {
    const title = input.trim();
    if (!title) return;
    setInput("");
    setShowInput(false);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: "today" }),
    });
    const d = await res.json();
    if (d.todo) setItems(prev => [{ ...d.todo, category: "task" as const }, ...prev]);
  }

  async function toggleTodo(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = item.status === "done" ? "pending" : "done";
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: next } : i));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function deleteTodo(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/todos/ai-suggest", { method: "POST" });
      const d = await res.json();
      if (d.todos) setItems(prev => [
        ...d.todos.map((t: TodoItem) => ({ ...t, category: "task" as const })),
        ...prev,
      ]);
    } finally { setAiLoading(false); }
  }

  const tasks = items.filter(i => i.category === "task");
  const taskPending = tasks.filter(i => i.status === "pending");
  const taskDone = tasks.filter(i => i.status === "done");
  const reviewTodos = items.filter(i => i.category === "review" && i.status === "pending");
  const reviewTotal = reviewTodos.length + reviewRecords.length;
  const totalTasks = tasks.length;
  const doneCount = taskDone.length;
  const pct = totalTasks > 0 ? Math.round(doneCount / totalTasks * 100) : 0;

  return (
    <AppLayout>
      <div style={pageStyle}>
        {/* ヘッダー背景グラデーション */}
        <div style={headerBgStyle} />

        <div style={innerStyle}>
          {/* 日付 */}
          <div style={dateRowStyle}>
            <div>
              <div style={dayNameStyle}>{WEEKDAYS[today.getDay()]}曜日</div>
              <div style={monthLabelStyle}>{today.getFullYear()}年 {MONTHS[today.getMonth()]}</div>
            </div>
            <button onClick={generateAI} disabled={aiLoading} style={aiChipStyle}>
              <Sparkles size={13} color="#3157B7" />
              <span>{aiLoading ? "生成中..." : "AIに提案"}</span>
            </button>
          </div>

          {/* 週カレンダー */}
          {!isCurrentWeek && (
            <button onClick={() => { setWeekOffset(0); setSelectedDate(today); }} style={backToTodayStyle}>
              今週に戻る
            </button>
          )}
          <div ref={weekCardRef} style={weekCardStyle}>
            {/* 前の週 */}
            <button onClick={() => setWeekOffset(o => o - 1)} style={weekNavBtnStyle}>
              <ChevronLeft size={16} color="#94A3B8" />
            </button>

            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const isSelected = d.toDateString() === selectedDate.toDateString();
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  style={weekColBtnStyle}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#3157B7" : "#94A3B8" }}>
                    {WEEKDAYS[d.getDay()]}
                  </span>
                  <div style={dayCircleStyle(isSelected, isToday)}>{d.getDate()}</div>
                  {isToday && <div style={activeDotStyle} />}
                </button>
              );
            })}

            {/* 次の週 */}
            <button onClick={() => setWeekOffset(o => o + 1)} style={weekNavBtnStyle}>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
          </div>


          {/* 進捗サマリー */}
          {totalTasks > 0 && (
            <div style={progressCardStyle}>
              <div style={progressRingWrapStyle}>
                <svg width={52} height={52}>
                  <circle cx={26} cy={26} r={20} fill="none" stroke="#EEF2FF" strokeWidth={5} />
                  <circle cx={26} cy={26} r={20} fill="none" stroke="#3157B7" strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
                    transform="rotate(-90 26 26)"
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                  <text x={26} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#3157B7">{pct}%</text>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                  {doneCount} / {totalTasks} 完了
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  {taskPending.length > 0 ? `あと ${taskPending.length} 件` : "今日のタスク完了！"}
                </div>
              </div>
              <div style={progressBarWrapStyle}>
                <div style={progressBgStyle}>
                  <div style={{ ...progressFillStyle, width: `${pct}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* スペーサー（入力欄の分） */}

          {/* タスクリスト */}
          <div style={sectionStyle}>
            <div style={sectionLabelRowStyle}>
              <span style={sectionLabelStyle}>タスク</span>
              {taskPending.length > 0 && (
                <span style={badgeStyle("#EFF6FF", "#3157B7")}>{taskPending.length}</span>
              )}
            </div>

            {loading ? (
              <div style={emptyStyle}>読み込み中...</div>
            ) : taskPending.length === 0 && taskDone.length === 0 ? (
              <div style={emptyCardStyle}>
                <ClipboardList size={40} color="#CBD5E1" strokeWidth={1.5} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#64748B", marginTop: 12 }}>タスクがありません</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>＋ボタンかAI提案から追加できます</div>
              </div>
            ) : (
              <div style={listStyle}>
                {taskPending.map((item, i) => (
                  <TaskRow
                    key={item.id} item={item} index={i}
                    onToggle={toggleTodo} onDelete={deleteTodo}
                  />
                ))}
                {taskDone.length > 0 && (
                  <div style={doneGroupStyle}>
                    <div style={doneDividerStyle}>完了済み</div>
                    {taskDone.map((item, i) => (
                      <TaskRow key={item.id} item={item} index={i} onToggle={toggleTodo} onDelete={deleteTodo} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 復習リスト */}
          <div style={sectionStyle}>
            <button onClick={() => setReviewCollapsed(v => !v)} style={reviewHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={sectionLabelStyle}>復習リスト</span>
                {reviewTotal > 0 && <span style={badgeStyle("#FFFBEB", "#D97706")}>{reviewTotal}</span>}
              </div>
              <ChevronDown size={16} color="#94A3B8"
                style={{ transform: reviewCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {!reviewCollapsed && (
              <div style={listStyle}>
                {reviewTotal === 0 ? (
                  <div style={emptyCardStyle}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#64748B" }}>復習項目なし</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>演習で「要復習」にした問題がここに表示されます</div>
                  </div>
                ) : (
                  <>
                    {reviewTodos.map((item, i) => (
                      <TaskRow key={item.id} item={item} index={i} onToggle={toggleTodo} onDelete={deleteTodo} accent="#D97706" />
                    ))}
                    {reviewRecords.map(rec => (
                      <div key={rec.id} style={reviewRecordStyle}>
                        <div style={reviewIconStyle}><BookOpen size={16} color="#D97706" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", lineHeight: 1.4 }}>
                            {rec.material || "教材"}{rec.range ? `  ${rec.range}` : ""}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{rec.date}</div>
                        </div>
                        <Link href={`/my-sensei?exercise_id=${rec.id}`} style={askBtnStyle}>
                          <GraduationCap size={12} /> 先生に聞く
                        </Link>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* FAB */}
      <button onClick={openInput} style={fabStyle}>
        <Plus size={26} color="#fff" strokeWidth={2.5} />
      </button>

      {/* ボトムシート */}
      {showInput && (
        <>
          <div onClick={() => { setShowInput(false); setInput(""); }} style={sheetOverlayStyle} />
          <div style={sheetStyle}>
            <div style={sheetHandleStyle} />
            <div style={sheetBodyStyle}>
              <div style={sheetTitleStyle}>タスクを追加</div>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addTodo(); if (e.key === "Escape") { setShowInput(false); setInput(""); } }}
                placeholder="例: 数学の問題集 p.30〜40"
                style={sheetInputStyle}
                autoFocus
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowInput(false); setInput(""); }} style={sheetCancelStyle}>
                  キャンセル
                </button>
                <button onClick={addTodo} disabled={!input.trim()} style={sheetSubmitStyle}>
                  追加する
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function TaskRow({ item, index, onToggle, onDelete, accent = "#3157B7" }: {
  item: TodoItem; index: number;
  onToggle: (id: string) => void; onDelete: (id: string) => void;
  accent?: string;
}) {
  const done = item.status === "done";
  const [hover, setHover] = useState(false);
  return (
    <div
      style={taskRowStyle(done, hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ width: 3, borderRadius: 999, background: done ? "#E2E8F0" : accent, alignSelf: "stretch", flexShrink: 0 }} />
      <button onClick={() => onToggle(item.id)} style={checkBtnBaseStyle}>
        {done
          ? <CheckCircle2 size={26} color={accent} strokeWidth={2} />
          : <Circle size={26} color="#CBD5E1" strokeWidth={1.8} />}
      </button>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none", lineHeight: 1.5 }}>
        {item.title}
      </span>
      <button onClick={() => onDelete(item.id)} style={deleteBtnStyle(hover)}>
        <X size={14} />
      </button>
    </div>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F4F6FB", position: "relative" };
const headerBgStyle: CSSProperties = {
  position: "absolute", top: 0, left: 0, right: 0, height: 220,
  background: "linear-gradient(160deg, #EEF2FF 0%, #F4F6FB 100%)",
  zIndex: 0,
};
const innerStyle: CSSProperties = {
  position: "relative", zIndex: 1,
  maxWidth: 480, margin: "0 auto", padding: "24px 18px 120px", display: "grid", gap: 20,
};

const dateRowStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between" };
const dayNameStyle: CSSProperties = { fontSize: 32, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.04em", lineHeight: 1.1 };
const monthLabelStyle: CSSProperties = { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: 500 };
const aiChipStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "8px 14px", borderRadius: 999,
  background: "#fff", border: "1px solid #BFDBFE",
  fontSize: 13, fontWeight: 700, color: "#3157B7", cursor: "pointer",
  boxShadow: "0 2px 8px rgba(49,87,183,0.10)", fontFamily: "inherit",
};

const weekCardStyle: CSSProperties = {
  background: "#fff", borderRadius: 20, padding: "12px 4px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
  userSelect: "none",
};
const weekNavBtnStyle: CSSProperties = {
  width: 32, height: 32, border: "none", background: "transparent",
  cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
};
const weekColBtnStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
  background: "transparent", border: "none", cursor: "pointer", padding: "0 2px",
};
function dayCircleStyle(isSelected: boolean, isToday: boolean): CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 10,
    background: isSelected ? "#3157B7" : isToday ? "#EEF2FF" : "transparent",
    display: "grid", placeItems: "center",
    fontSize: 15, fontWeight: isSelected ? 800 : 500,
    color: isSelected ? "#fff" : isToday ? "#3157B7" : "#475569",
    transition: "all 0.15s",
  };
}
const activeDotStyle: CSSProperties = { width: 4, height: 4, borderRadius: 999, background: "#3157B7" };
const backToTodayStyle: CSSProperties = {
  display: "block", margin: "0 auto",
  padding: "6px 16px", borderRadius: 999,
  border: "1px solid #BFDBFE", background: "#EFF6FF",
  fontSize: 12, fontWeight: 700, color: "#3157B7",
  cursor: "pointer", fontFamily: "inherit",
};

const progressCardStyle: CSSProperties = {
  background: "#fff", borderRadius: 20, padding: "16px 18px",
  display: "flex", alignItems: "center", gap: 16,
  boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
};
const progressRingWrapStyle: CSSProperties = { flexShrink: 0 };
const progressBarWrapStyle: CSSProperties = { flex: 1 };
const progressBgStyle: CSSProperties = { height: 4, borderRadius: 999, background: "#EEF2FF", overflow: "hidden" };
const progressFillStyle: CSSProperties = { height: "100%", borderRadius: 999, background: "#3157B7", transition: "width 0.5s ease" };

const fabStyle: CSSProperties = {
  position: "fixed", bottom: 96, right: 22,
  width: 58, height: 58, borderRadius: 999,
  background: "#3157B7",
  border: "none", cursor: "pointer",
  display: "grid", placeItems: "center",
  boxShadow: "0 6px 24px rgba(49,87,183,0.38)",
  zIndex: 150,
};

const sheetOverlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 200,
};
const sheetStyle: CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
  background: "#fff", borderRadius: "24px 24px 0 0",
  padding: "0 0 env(safe-area-inset-bottom)",
  boxShadow: "0 -8px 40px rgba(15,23,42,0.12)",
  animation: "slideUp 0.22s ease",
};
const sheetHandleStyle: CSSProperties = {
  width: 36, height: 4, borderRadius: 999, background: "#E2E8F0",
  margin: "12px auto 0",
};
const sheetBodyStyle: CSSProperties = {
  padding: "20px 20px 32px", display: "grid", gap: 16,
};
const sheetTitleStyle: CSSProperties = {
  fontSize: 17, fontWeight: 900, color: "#0F172A",
};
const sheetInputStyle: CSSProperties = {
  padding: "14px 16px", borderRadius: 14,
  border: "1.5px solid #BFDBFE", outline: "none",
  fontSize: 16, color: "#0F172A", fontFamily: "inherit",
  background: "#F8FAFF",
};
const sheetCancelStyle: CSSProperties = {
  flex: 1, padding: "14px", borderRadius: 14,
  border: "1px solid #E2E8F0", background: "#F8FAFC",
  fontSize: 15, fontWeight: 700, color: "#64748B",
  cursor: "pointer", fontFamily: "inherit",
};
const sheetSubmitStyle: CSSProperties = {
  flex: 2, padding: "14px", borderRadius: 14,
  border: "none", background: "#3157B7",
  fontSize: 15, fontWeight: 800, color: "#fff",
  cursor: "pointer", fontFamily: "inherit",
};

const sectionStyle: CSSProperties = { display: "grid", gap: 12 };
const sectionLabelRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, paddingLeft: 2 };
const sectionLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" };
function badgeStyle(bg: string, color: string): CSSProperties {
  return { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: bg, color };
}

const listStyle: CSSProperties = {
  background: "#fff", borderRadius: 20, overflow: "hidden",
  boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
};

const emptyStyle: CSSProperties = { padding: "20px", textAlign: "center", fontSize: 13, color: "#CBD5E1" };
const emptyCardStyle: CSSProperties = {
  background: "#fff", borderRadius: 20, padding: "32px 20px",
  textAlign: "center", boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
};
const doneGroupStyle: CSSProperties = { borderTop: "1px solid #F1F5F9" };
const doneDividerStyle: CSSProperties = { padding: "10px 18px 6px", fontSize: 11, fontWeight: 700, color: "#CBD5E1", letterSpacing: "0.06em", textTransform: "uppercase" };

function taskRowStyle(done: boolean, hover: boolean): CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
    borderBottom: "1px solid #F8FAFC",
    background: hover && !done ? "#FAFBFF" : "transparent",
    transition: "background 0.15s",
    opacity: done ? 0.65 : 1,
  };
}
const checkBtnBaseStyle: CSSProperties = {
  border: "none", background: "transparent", padding: 0,
  cursor: "pointer", display: "flex", flexShrink: 0,
  transition: "transform 0.1s",
};
function deleteBtnStyle(hover: boolean): CSSProperties {
  return {
    border: "none", background: "transparent", cursor: "pointer",
    color: hover ? "#CBD5E1" : "transparent", padding: 4,
    display: "flex", flexShrink: 0, transition: "color 0.15s",
  };
}

const reviewHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "transparent", border: "none", cursor: "pointer", padding: "0 2px", width: "100%", fontFamily: "inherit",
};
const reviewRecordStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F8FAFC",
};
const reviewIconStyle: CSSProperties = { width: 32, height: 32, borderRadius: 10, background: "#FFFBEB", display: "grid", placeItems: "center", flexShrink: 0 };
const askBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
  borderRadius: 999, background: "#FFFBEB", color: "#D97706",
  fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0,
  border: "1px solid #FDE68A",
};
