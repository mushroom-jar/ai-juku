"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import {
  Check, Circle, Plus, Sparkles, Trash2, GraduationCap, RefreshCw, BookOpen,
} from "lucide-react";

type Category = "today" | "review" | "other";
type TodoItem = {
  id: string;
  title: string;
  category: Category;
  status: "pending" | "done";
  source: string;
  created_at: string;
};
type ReviewRecord = {
  id: string;
  material: string | null;
  range: string | null;
  subject: string | null;
  date: string;
  book_id: string | null;
};

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [input, setInput] = useState("");
  const [addTarget, setAddTarget] = useState<Category>("today");
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeInput, setActiveInput] = useState<Category | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/todos").then(r => r.ok ? r.json() : { todos: [] }),
      fetch("/api/todos/review-records").then(r => r.ok ? r.json() : { records: [] }),
    ]).then(([td, rv]) => {
      setItems(td.todos ?? []);
      setReviewRecords(rv.records ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function addTodo(category: Category) {
    const title = input.trim();
    if (!title) return;
    setInput("");
    setActiveInput(null);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category }),
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

  async function deleteTodo(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/todos/ai-suggest", { method: "POST" });
      const d = await res.json();
      if (d.todos) setItems(prev => [...d.todos, ...prev]);
    } finally {
      setAiLoading(false);
    }
  }

  const todayPending  = items.filter(i => i.category === "today"  && i.status === "pending");
  const reviewPending = items.filter(i => i.category === "review" && i.status === "pending");
  const otherPending  = items.filter(i => i.category === "other"  && i.status === "pending");
  const done          = items.filter(i => i.status === "done");

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={innerStyle}>

          {/* ヘッダー */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>Todo</h1>
            <Link href="/my-sensei?mode=todo" style={senseiLinkStyle}>
              <GraduationCap size={15} />先生に相談
            </Link>
          </div>

          {/* AI提案 */}
          <button onClick={generateAI} disabled={aiLoading} style={aiBannerStyle}>
            <div style={aiIconStyle}>
              <Sparkles size={17} color="#3157B7" />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                {aiLoading ? "AIが考えています..." : "今日のタスクをAIに提案してもらう"}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>
                目標と演習記録から自動でTodoを追加
              </div>
            </div>
            {aiLoading
              ? <RefreshCw size={16} color="#94A3B8" style={{ animation: "spin 1s linear infinite" }} />
              : <Sparkles size={16} color="#BFDBFE" />}
          </button>

          {/* 今日やること */}
          <Section
            title="今日やること"
            color="#3157B7"
            bg="#EFF6FF"
            items={todayPending}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            activeInput={activeInput === "today"}
            onOpenInput={() => { setActiveInput("today"); setAddTarget("today"); setTimeout(() => inputRef.current?.focus(), 50); }}
            inputValue={activeInput === "today" ? input : ""}
            onInputChange={setInput}
            onAdd={() => addTodo("today")}
            inputRef={activeInput === "today" ? inputRef : undefined}
            loading={loading}
          />

          {/* 復習リスト */}
          <ReviewSection
            title="復習リスト"
            color="#D97706"
            bg="#FFFBEB"
            todos={reviewPending}
            records={reviewRecords}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            activeInput={activeInput === "review"}
            onOpenInput={() => { setActiveInput("review"); setAddTarget("review"); setTimeout(() => inputRef.current?.focus(), 50); }}
            inputValue={activeInput === "review" ? input : ""}
            onInputChange={setInput}
            onAdd={() => addTodo("review")}
            inputRef={activeInput === "review" ? inputRef : undefined}
            loading={loading}
          />

          {/* あとで */}
          <Section
            title="あとで"
            color="#64748B"
            bg="#F8FAFC"
            items={otherPending}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            activeInput={activeInput === "other"}
            onOpenInput={() => { setActiveInput("other"); setAddTarget("other"); setTimeout(() => inputRef.current?.focus(), 50); }}
            inputValue={activeInput === "other" ? input : ""}
            onInputChange={setInput}
            onAdd={() => addTodo("other")}
            inputRef={activeInput === "other" ? inputRef : undefined}
            loading={loading}
          />

          {/* 完了済み */}
          {done.length > 0 && (
            <div>
              <div style={doneLabelStyle}>完了済み（{done.length}）</div>
              <div style={{ ...listCardStyle, opacity: 0.65 }}>
                {done.map(item => (
                  <TodoRow key={item.id} item={item} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}

// ─── セクション ────────────────────────────────────────────────
function Section({ title, color, bg, items, onToggle, onDelete, activeInput, onOpenInput, inputValue, onInputChange, onAdd, inputRef, loading }: {
  title: string; color: string; bg: string;
  items: TodoItem[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  activeInput: boolean;
  onOpenInput: () => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  loading: boolean;
}) {
  return (
    <div style={sectionWrapStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</span>
          {items.length > 0 && <span style={{ ...countBadgeStyle, background: bg, color }}>{items.length}</span>}
        </div>
        <button onClick={onOpenInput} style={{ ...addRowBtnStyle, color }}>
          <Plus size={15} /> 追加
        </button>
      </div>

      <div style={listCardStyle}>
        {activeInput && (
          <div style={inlineInputRowStyle}>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement> | undefined}
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onAdd(); if (e.key === "Escape") onInputChange(""); }}
              placeholder="タスクを入力..."
              style={inlineInputStyle}
              autoFocus
            />
            <button onClick={onAdd} disabled={!inputValue.trim()} style={{ ...inlineAddBtnStyle, background: color }}>追加</button>
          </div>
        )}
        {loading ? (
          <div style={emptyStyle}>読み込み中...</div>
        ) : items.length === 0 && !activeInput ? (
          <div style={emptyStyle}>タスクなし</div>
        ) : (
          items.map(item => <TodoRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />)
        )}
      </div>
    </div>
  );
}

function ReviewSection({ title, color, bg, todos, records, onToggle, onDelete, activeInput, onOpenInput, inputValue, onInputChange, onAdd, inputRef, loading }: {
  title: string; color: string; bg: string;
  todos: TodoItem[];
  records: ReviewRecord[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  activeInput: boolean;
  onOpenInput: () => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  loading: boolean;
}) {
  const total = todos.length + records.length;
  return (
    <div style={sectionWrapStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</span>
          {total > 0 && <span style={{ ...countBadgeStyle, background: bg, color }}>{total}</span>}
        </div>
        <button onClick={onOpenInput} style={{ ...addRowBtnStyle, color }}>
          <Plus size={15} /> 追加
        </button>
      </div>

      <div style={listCardStyle}>
        {activeInput && (
          <div style={inlineInputRowStyle}>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement> | undefined}
              value={inputValue}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onAdd(); }}
              placeholder="復習内容を入力..."
              style={inlineInputStyle}
              autoFocus
            />
            <button onClick={onAdd} disabled={!inputValue.trim()} style={{ ...inlineAddBtnStyle, background: color }}>追加</button>
          </div>
        )}

        {loading ? (
          <div style={emptyStyle}>読み込み中...</div>
        ) : (
          <>
            {todos.map(item => <TodoRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />)}
            {records.map(rec => (
              <div key={rec.id} style={reviewRecordRowStyle}>
                <BookOpen size={16} color="#D97706" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
                    {rec.material || "教材"}{rec.range ? `　${rec.range}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{rec.date} の演習</div>
                </div>
                <Link href={`/my-sensei?exercise_id=${rec.id}`} style={askSenseiStyle}>
                  <GraduationCap size={13} /> 聞く
                </Link>
              </div>
            ))}
            {todos.length === 0 && records.length === 0 && !activeInput && (
              <div style={emptyStyle}>復習はありません</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TodoRow({ item, onToggle, onDelete }: {
  item: TodoItem; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const done = item.status === "done";
  return (
    <div style={rowStyle(done)}>
      <button onClick={() => onToggle(item.id)} style={checkStyle(done)}>
        {done ? <Check size={20} strokeWidth={2.5} /> : <Circle size={20} strokeWidth={1.8} />}
      </button>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none", lineHeight: 1.4 }}>
        {item.title}
      </div>
      <button onClick={() => onDelete(item.id)} style={deleteStyle}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const innerStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "24px 18px 120px", display: "grid", gap: 20 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A" };
const senseiLinkStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 999, background: "#FFF7ED", color: "#EA580C", fontSize: 13, fontWeight: 700, textDecoration: "none" };

const aiBannerStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 18, background: "#F0F7FF", border: "1.5px solid #C7DEFF", cursor: "pointer", width: "100%" };
const aiIconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 10, background: "#DBEAFE", display: "grid", placeItems: "center", flexShrink: 0 };

const sectionWrapStyle: CSSProperties = { display: "grid", gap: 10 };
const sectionHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const countBadgeStyle: CSSProperties = { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999 };
const addRowBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: "inherit" };

const listCardStyle: CSSProperties = { background: "#fff", borderRadius: 20, border: "1px solid #E2E8F0", overflow: "hidden" };
const emptyStyle: CSSProperties = { padding: "20px 0", textAlign: "center", fontSize: 13, color: "#CBD5E1" };

const inlineInputRowStyle: CSSProperties = { display: "flex", gap: 8, padding: "12px 14px", borderBottom: "1px solid #F1F5F9" };
const inlineInputStyle: CSSProperties = { flex: 1, border: "none", outline: "none", fontSize: 15, color: "#0F172A", background: "transparent", fontFamily: "inherit" };
const inlineAddBtnStyle: CSSProperties = { padding: "7px 14px", borderRadius: 10, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" };

const doneLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 8, paddingLeft: 4 };

const reviewRecordRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F1F5F9" };
const askSenseiStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, background: "#FFF7ED", color: "#EA580C", fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 };

function rowStyle(done: boolean): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F1F5F9", opacity: done ? 0.7 : 1 };
}
function checkStyle(done: boolean): CSSProperties {
  return { border: "none", background: "transparent", padding: 0, cursor: "pointer", color: done ? "#16A34A" : "#CBD5E1", flexShrink: 0, display: "flex" };
}
const deleteStyle: CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "#E2E8F0", padding: 4, display: "flex", flexShrink: 0 };
