"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import {
  Check, Circle, Plus, Sparkles, Trash2, GraduationCap, RefreshCw,
} from "lucide-react";

type Category = "today" | "review" | "other";
type TodoItem = {
  id: string;
  title: string;
  category: Category;
  status: "pending" | "done";
  created_at: string;
};

const CATEGORIES: { value: Category; label: string; color: string; bg: string }[] = [
  { value: "today",  label: "今日やる", color: "#3157B7", bg: "#EFF6FF" },
  { value: "review", label: "復習",    color: "#D97706", bg: "#FFFBEB" },
  { value: "other",  label: "あとで",  color: "#64748B", bg: "#F8FAFC" },
];

function getCatStyle(cat: Category) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2];
}

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<Category>("today");
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/todos")
      .then(r => r.ok ? r.json() : { todos: [] })
      .then(d => setItems(d.todos ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function addTodo() {
    const title = input.trim();
    if (!title) return;
    setInput("");
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category }),
    });
    const d = await res.json();
    if (d.todo) setItems(prev => [d.todo, ...prev]);
    inputRef.current?.focus();
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

  const filtered = filter === "all"
    ? items
    : items.filter(i => i.category === filter);

  const pending = filtered.filter(i => i.status === "pending");
  const done = filtered.filter(i => i.status === "done");

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={innerStyle}>

          {/* ヘッダー */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>Todo</h1>
            <Link href="/my-sensei?mode=todo" style={senseiLinkStyle}>
              <GraduationCap size={16} />
              先生に相談
            </Link>
          </div>

          {/* AI提案バナー */}
          <button onClick={generateAI} disabled={aiLoading} style={aiBannerStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={aiIconStyle}><Sparkles size={18} color="#3157B7" /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                  {aiLoading ? "AIが考えています..." : "AIに今日のタスクを提案してもらう"}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  目標と演習記録から自動でTodoを作成します
                </div>
              </div>
            </div>
            {aiLoading
              ? <RefreshCw size={18} color="#94A3B8" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              : <Sparkles size={18} color="#3157B7" style={{ flexShrink: 0 }} />}
          </button>

          {/* 入力エリア */}
          <div style={inputCardStyle}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTodo()}
              placeholder="Todoを追加..."
              style={inputStyle}
            />
            <div style={catRowStyle}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  style={{
                    ...catBtnStyle,
                    background: category === c.value ? c.bg : "transparent",
                    color: category === c.value ? c.color : "#94A3B8",
                    border: category === c.value ? `1.5px solid ${c.color}30` : "1.5px solid transparent",
                    fontWeight: category === c.value ? 800 : 600,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={addTodo} disabled={!input.trim()} style={addBtnStyle}>
              <Plus size={18} />
              追加
            </button>
          </div>

          {/* フィルター */}
          <div style={filterRowStyle}>
            {[{ value: "all" as const, label: "すべて" }, ...CATEGORIES].map(c => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                style={{
                  ...filterBtnStyle,
                  background: filter === c.value ? "#0F172A" : "transparent",
                  color: filter === c.value ? "#fff" : "#64748B",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* リスト */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>読み込み中...</div>
          ) : (
            <>
              {/* 未完了 */}
              <div style={listCardStyle}>
                {pending.length === 0 ? (
                  <div style={emptyStyle}>タスクがありません</div>
                ) : pending.map(item => (
                  <TodoRow key={item.id} item={item} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
              </div>

              {/* 完了済み */}
              {done.length > 0 && (
                <div>
                  <div style={doneLabelStyle}>完了済み（{done.length}）</div>
                  <div style={{ ...listCardStyle, opacity: 0.7 }}>
                    {done.map(item => (
                      <TodoRow key={item.id} item={item} onToggle={toggleTodo} onDelete={deleteTodo} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function TodoRow({ item, onToggle, onDelete }: {
  item: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cat = getCatStyle(item.category);
  const done = item.status === "done";
  return (
    <div style={rowStyle(done)}>
      <button onClick={() => onToggle(item.id)} style={checkStyle(done)}>
        {done
          ? <Check size={20} strokeWidth={2.5} />
          : <Circle size={20} strokeWidth={1.8} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: done ? "#94A3B8" : "#0F172A", textDecoration: done ? "line-through" : "none", lineHeight: 1.4 }}>
          {item.title}
        </div>
        <span style={{ ...catTagStyle, background: cat.bg, color: cat.color }}>{cat.label}</span>
      </div>
      <button onClick={() => onDelete(item.id)} style={deleteStyle}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const innerStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "24px 18px 120px", display: "grid", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A" };
const senseiLinkStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: "#FFF7ED", color: "#EA580C", fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid #FDBA7430" };

const aiBannerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 18px", borderRadius: 20, background: "#F0F7FF", border: "1.5px solid #C7DEFF", cursor: "pointer", textAlign: "left", width: "100%" };
const aiIconStyle: CSSProperties = { width: 40, height: 40, borderRadius: 12, background: "#DBEAFE", display: "grid", placeItems: "center", flexShrink: 0 };

const inputCardStyle: CSSProperties = { background: "#fff", borderRadius: 22, padding: "16px", border: "1px solid #E2E8F0", display: "grid", gap: 12 };
const inputStyle: CSSProperties = { border: "none", outline: "none", fontSize: 16, color: "#0F172A", background: "transparent", width: "100%", fontFamily: "inherit" };
const catRowStyle: CSSProperties = { display: "flex", gap: 8 };
const catBtnStyle: CSSProperties = { padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const addBtnStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 14, background: "#0F172A", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" };

const filterRowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const filterBtnStyle: CSSProperties = { padding: "7px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" };

const listCardStyle: CSSProperties = { background: "#fff", borderRadius: 22, border: "1px solid #E2E8F0", overflow: "hidden" };
const emptyStyle: CSSProperties = { padding: "32px 0", textAlign: "center", fontSize: 14, color: "#94A3B8" };
const doneLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 8, paddingLeft: 4 };

function rowStyle(done: boolean): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: "1px solid #F1F5F9", opacity: done ? 0.8 : 1 };
}
function checkStyle(done: boolean): CSSProperties {
  return { border: "none", background: "transparent", padding: 0, cursor: "pointer", color: done ? "#16A34A" : "#CBD5E1", flexShrink: 0, display: "flex" };
}
const deleteStyle: CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "#E2E8F0", padding: 4, display: "flex", flexShrink: 0 };
const catTagStyle: CSSProperties = { display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999 };
