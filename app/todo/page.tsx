"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, GraduationCap, Plus, Sparkles, BookOpen } from "lucide-react";

type Category = "today" | "review" | "other";
type TodoItem = {
  id: string; title: string; category: Category;
  status: "pending" | "done"; source: string; created_at: string;
};
type ReviewRecord = {
  id: string; material: string | null; range: string | null;
  subject: string | null; date: string; book_id: string | null;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const SECTIONS: { key: Category; label: string; emoji: string; color: string; pillBg: string }[] = [
  { key: "today",  label: "今日やること", emoji: "📚", color: "#3157B7", pillBg: "rgba(49,87,183,0.10)" },
  { key: "review", label: "復習",        emoji: "🔁", color: "#D97706", pillBg: "rgba(217,119,6,0.10)" },
  { key: "other",  label: "あとで",      emoji: "🕐", color: "#64748B", pillBg: "rgba(100,116,139,0.10)" },
];

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({} as Record<Category, boolean>);
  const [addingTo, setAddingTo] = useState<Category | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/todos").then(r => r.ok ? r.json() : { todos: [] }),
      fetch("/api/todos/review-records").then(r => r.ok ? r.json() : { records: [] }),
    ]).then(([td, rv]) => {
      setItems(td.todos ?? []);
      setReviewRecords(rv.records ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function addTodo(cat: Category) {
    const title = input.trim();
    if (!title) return;
    setInput("");
    setAddingTo(null);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: cat }),
    });
    const d = await res.json();
    if (d.todo) setItems(prev => [d.todo, ...prev]);
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

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/todos/ai-suggest", { method: "POST" });
      const d = await res.json();
      if (d.todos) setItems(prev => [...d.todos, ...prev]);
    } finally { setAiLoading(false); }
  }

  function toggleCollapse(cat: Category) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  function openAdd(cat: Category) {
    setAddingTo(cat);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={innerStyle}>

          {/* 日付ヘッダー */}
          <div style={dateHeaderStyle}>
            <div style={dayLabelStyle}>{WEEKDAYS[today.getDay()]}曜日</div>
            <div style={{ fontSize: 13, color: "#94A3B8", display: "flex", alignItems: "center", gap: 4 }}>
              {today.getFullYear()}年{today.getMonth() + 1}月
              <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
            </div>
          </div>

          {/* 週カレンダー */}
          <div style={weekRowStyle}>
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} style={weekDayColStyle}>
                  <div style={{ fontSize: 11, color: isToday ? "#3157B7" : "#94A3B8", fontWeight: 600, marginBottom: 6 }}>
                    {WEEKDAYS[d.getDay()]}
                  </div>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: isToday ? "#3157B7" : "transparent",
                    display: "grid", placeItems: "center",
                    fontSize: 17, fontWeight: isToday ? 800 : 500,
                    color: isToday ? "#fff" : "#94A3B8",
                  }}>
                    {d.getDate()}
                  </div>
                  {isToday && <div style={todayDotStyle} />}
                </div>
              );
            })}
          </div>

          {/* AI提案ボタン */}
          <button onClick={generateAI} disabled={aiLoading} style={aiButtonStyle}>
            <Sparkles size={15} color="#C9A84C" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#3157B7" }}>
              {aiLoading ? "AIが考えています..." : "AIにタスクを提案してもらう"}
            </span>
          </button>

          {/* セクション */}
          {SECTIONS.map(sec => {
            const secItems = items.filter(i => i.category === sec.key);
            const pending = secItems.filter(i => i.status === "pending");
            const done = secItems.filter(i => i.status === "done");
            const total = sec.key === "review" ? pending.length + reviewRecords.length : pending.length;
            const isCollapsed = !!collapsed[sec.key];

            return (
              <div key={sec.key} style={sectionWrapStyle}>
                {/* セクションヘッダー */}
                <div style={sectionHeaderStyle}>
                  <button onClick={() => toggleCollapse(sec.key)} style={pillBtnStyle(sec.pillBg)}>
                    <span style={{ fontSize: 13 }}>{sec.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: sec.color }}>
                      {sec.label}（{total}）
                    </span>
                    <ChevronDown size={14} color={sec.color}
                      style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s" }} />
                  </button>
                  <button onClick={() => openAdd(sec.key)} style={plusBtnStyle}>
                    <Plus size={18} color="rgba(255,255,255,0.5)" />
                  </button>
                </div>

                {/* タスクリスト */}
                {!isCollapsed && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {/* インライン追加 */}
                    {addingTo === sec.key && (
                      <div style={addRowStyle}>
                        <span style={{ fontSize: 18 }}>{sec.emoji}</span>
                        <input
                          ref={inputRef}
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addTodo(sec.key); if (e.key === "Escape") setAddingTo(null); }}
                          placeholder="タスクを入力..."
                          style={addInputStyle}
                          autoFocus
                        />
                        <button onClick={() => addTodo(sec.key)} disabled={!input.trim()} style={{ ...confirmBtnStyle, background: sec.pillBg, color: sec.color }}>
                          追加
                        </button>
                      </div>
                    )}

                    {/* 未完了 */}
                    {loading ? (
                      <TaskCard emoji="⏳" title="読み込み中..." done={false} onToggle={() => {}} />
                    ) : (
                      <>
                        {pending.map(item => (
                          <TaskCard key={item.id} emoji={sec.emoji} title={item.title} done={false} onToggle={() => toggleTodo(item.id)} />
                        ))}
                        {sec.key === "review" && reviewRecords.map(rec => (
                          <ReviewRecordCard key={rec.id} record={rec} />
                        ))}
                        {pending.length === 0 && (sec.key !== "review" || reviewRecords.length === 0) && addingTo !== sec.key && (
                          <div style={emptyRowStyle}>タスクなし</div>
                        )}
                      </>
                    )}

                    {/* 完了済み */}
                    {done.length > 0 && (
                      <>
                        <div style={progressBarBgStyle}>
                          <div style={{ ...progressBarFillStyle, width: `${Math.round(done.length / secItems.length * 100)}%`, background: sec.color }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>
                          {done.length} / {secItems.length} 完了
                        </div>
                        {done.map(item => (
                          <TaskCard key={item.id} emoji={sec.emoji} title={item.title} done={true} onToggle={() => toggleTodo(item.id)} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function TaskCard({ emoji, title, done, onToggle }: {
  emoji: string; title: string; done: boolean; onToggle: () => void;
}) {
  return (
    <div style={taskCardStyle(done)} onClick={onToggle}>
      <div style={taskIconStyle}>{emoji}</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: done ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: done ? "line-through" : "none" }}>
        {title}
      </div>
      <div style={circleStyle(done)}>
        {done && <Check size={14} color="#fff" strokeWidth={3} />}
      </div>
    </div>
  );
}

function ReviewRecordCard({ record }: { record: ReviewRecord }) {
  return (
    <div style={taskCardStyle(false)}>
      <div style={taskIconStyle}><BookOpen size={18} color="#A78BFA" /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
          {record.material || "教材"}{record.range ? `　${record.range}` : ""}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{record.date} の演習</div>
      </div>
      <Link href={`/my-sensei?exercise_id=${record.id}`} onClick={e => e.stopPropagation()} style={askStyle}>
        <GraduationCap size={13} /> 聞く
      </Link>
    </div>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const innerStyle: CSSProperties = { maxWidth: 480, margin: "0 auto", padding: "20px 18px 120px", display: "grid", gap: 20 };

const dateHeaderStyle: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between" };
const dayLabelStyle: CSSProperties = { fontSize: 36, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.04em" };

const weekRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between" };
const weekDayColStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 0 };
const todayDotStyle: CSSProperties = { width: 5, height: 5, borderRadius: 999, background: "#3157B7", marginTop: 4 };

const aiButtonStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
  borderRadius: 14, background: "#EFF6FF", border: "1px solid #BFDBFE",
  cursor: "pointer", width: "100%",
};

const sectionWrapStyle: CSSProperties = { display: "grid", gap: 10 };
const sectionHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };

function pillBtnStyle(bg: string): CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: bg, border: "none", cursor: "pointer", fontFamily: "inherit" };
}
const plusBtnStyle: CSSProperties = { width: 36, height: 36, borderRadius: 999, background: "#E2E8F0", border: "none", cursor: "pointer", display: "grid", placeItems: "center" };

const addRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0" };
const addInputStyle: CSSProperties = { flex: 1, border: "none", outline: "none", fontSize: 15, color: "#0F172A", background: "transparent", fontFamily: "inherit" };
const confirmBtnStyle: CSSProperties = { padding: "6px 14px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };

const emptyRowStyle: CSSProperties = { padding: "14px 16px", fontSize: 13, color: "#CBD5E1", textAlign: "center" };

const progressBarBgStyle: CSSProperties = { height: 3, borderRadius: 999, background: "#E2E8F0", overflow: "hidden" };
const progressBarFillStyle: CSSProperties = { height: "100%", borderRadius: 999, transition: "width 0.4s ease" };

function taskCardStyle(done: boolean): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0", cursor: "pointer", opacity: done ? 0.55 : 1 };
}
const taskIconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 10, background: "#F1F5F9", display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0 };
function circleStyle(done: boolean): CSSProperties {
  return { width: 26, height: 26, borderRadius: 999, border: done ? "none" : "2px solid #CBD5E1", background: done ? "#3157B7" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 };
}
const askStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, background: "#FFF7ED", color: "#D97706", fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 };
