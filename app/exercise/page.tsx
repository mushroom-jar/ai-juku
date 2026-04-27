"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import { BookOpen, ChevronRight, Plus, GraduationCap, Search, SlidersHorizontal } from "lucide-react";

type Subject = "math" | "english" | "japanese" | "science" | "social" | "other";
type Book = {
  id: string;
  title: string;
  subject: Subject;
  total_pages: number | null;
  current_page: number | null;
  cover_color: string;
  exercise_count: number;
  last_exercised_at: string | null;
};

const SUBJECTS: { value: Subject; label: string; color: string; bg: string }[] = [
  { value: "math",     label: "数学",   color: "#3157B7", bg: "#EFF6FF" },
  { value: "english",  label: "英語",   color: "#0F766E", bg: "#F0FDFA" },
  { value: "japanese", label: "国語",   color: "#B45309", bg: "#FFFBEB" },
  { value: "science",  label: "理科",   color: "#059669", bg: "#F0FDF4" },
  { value: "social",   label: "社会",   color: "#7C3AED", bg: "#F5F3FF" },
  { value: "other",    label: "その他", color: "#475569", bg: "#F8FAFC" },
];

const COVER_COLORS = ["#3157B7","#0F766E","#B45309","#7C3AED","#EA580C","#475569"];

function getSubject(s: Subject) { return SUBJECTS.find(x => x.value === s) ?? SUBJECTS[5]; }

export default function ExercisePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Subject | "all">("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState<Subject>("math");
  const [newPages, setNewPages] = useState("");
  const [newColor, setNewColor] = useState(COVER_COLORS[0]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/exercise/books")
      .then(r => r.ok ? r.json() : { books: [] })
      .then(d => setBooks(d.books ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function addBook() {
    if (!newTitle.trim()) return;
    setAdding(true);
    const res = await fetch("/api/exercise/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        subject: newSubject,
        total_pages: newPages ? parseInt(newPages) : null,
        cover_color: newColor,
      }),
    });
    const d = await res.json();
    if (d.book) {
      setBooks(prev => [d.book, ...prev]);
      setShowAdd(false);
      setNewTitle(""); setNewPages(""); setNewSubject("math");
    }
    setAdding(false);
  }

  const filtered = books
    .filter(b => filter === "all" || b.subject === filter)
    .filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()));

  const grouped = SUBJECTS.map(s => ({
    ...s,
    books: filtered.filter(b => b.subject === s.value),
  })).filter(g => g.books.length > 0);

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={innerStyle}>

          {/* ヘッダー */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>演習</h1>
            <button onClick={() => setShowAdd(true)} style={addBtnStyle}>
              <Plus size={18} /> 教材を追加
            </button>
          </div>

          {/* 検索 */}
          <div style={searchBoxStyle}>
            <Search size={16} color="#94A3B8" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="教材を検索..."
              style={searchInputStyle}
            />
          </div>

          {/* 科目フィルター */}
          <div style={filterRowStyle}>
            <button onClick={() => setFilter("all")} style={{ ...filterBtnStyle, background: filter === "all" ? "#0F172A" : "transparent", color: filter === "all" ? "#fff" : "#64748B" }}>
              すべて
            </button>
            {SUBJECTS.map(s => (
              <button key={s.value} onClick={() => setFilter(s.value)} style={{
                ...filterBtnStyle,
                background: filter === s.value ? s.color : "transparent",
                color: filter === s.value ? "#fff" : "#64748B",
              }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* 教材リスト */}
          {loading ? (
            <div style={emptyStyle}>読み込み中...</div>
          ) : filtered.length === 0 ? (
            <div style={emptyCardStyle}>
              <BookOpen size={40} color="#CBD5E1" />
              <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: "#64748B" }}>教材がありません</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#94A3B8" }}>「教材を追加」から登録しましょう</div>
              <button onClick={() => setShowAdd(true)} style={{ ...addBtnStyle, marginTop: 16 }}>
                <Plus size={16} /> 追加する
              </button>
            </div>
          ) : (
            filter === "all"
              ? grouped.map(g => (
                <div key={g.value}>
                  <div style={groupHeaderStyle}>
                    <span style={{ ...subjectTagStyle, background: g.bg, color: g.color }}>{g.label}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{g.books.length}冊</span>
                  </div>
                  <div style={bookGridStyle}>
                    {g.books.map(b => <BookCard key={b.id} book={b} />)}
                  </div>
                </div>
              ))
              : (
                <div style={bookGridStyle}>
                  {filtered.map(b => <BookCard key={b.id} book={b} />)}
                </div>
              )
          )}
        </div>
      </div>

      {/* 教材追加モーダル */}
      {showAdd && (
        <>
          <div onClick={() => setShowAdd(false)} style={overlayStyle} />
          <div style={modalStyle}>
            <div style={modalHandleStyle} />
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>教材を追加</div>
              <button onClick={() => setShowAdd(false)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              <label style={labelStyle}>タイトル</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="例: チャート式 数学II"
                style={modalInputStyle}
                autoFocus
              />

              <label style={labelStyle}>科目</label>
              <div style={subjectGridStyle}>
                {SUBJECTS.map(s => (
                  <button key={s.value} onClick={() => setNewSubject(s.value)} style={{
                    ...subjectBtnStyle,
                    background: newSubject === s.value ? s.bg : "#F8FAFC",
                    color: newSubject === s.value ? s.color : "#64748B",
                    border: newSubject === s.value ? `1.5px solid ${s.color}40` : "1.5px solid transparent",
                    fontWeight: newSubject === s.value ? 800 : 600,
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>

              <label style={labelStyle}>総ページ数（任意）</label>
              <input
                type="number"
                value={newPages}
                onChange={e => setNewPages(e.target.value)}
                placeholder="例: 320"
                style={modalInputStyle}
              />

              <label style={labelStyle}>カラー</label>
              <div style={{ display: "flex", gap: 10 }}>
                {COVER_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} style={{
                    width: 32, height: 32, borderRadius: 999, background: c, border: newColor === c ? "3px solid #0F172A" : "3px solid transparent", cursor: "pointer",
                  }} />
                ))}
              </div>

              <button onClick={addBook} disabled={adding || !newTitle.trim()} style={modalSaveBtnStyle}>
                {adding ? "追加中..." : "追加する"}
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function BookCard({ book }: { book: Book }) {
  const sub = getSubject(book.subject);
  const progress = (book.total_pages && book.current_page)
    ? Math.round((book.current_page / book.total_pages) * 100) : null;

  return (
    <Link href={`/exercise/${book.id}`} style={bookCardStyle}>
      {/* 表紙 */}
      <div style={{ ...bookCoverStyle, background: book.cover_color }}>
        <BookOpen size={22} color="rgba(255,255,255,0.9)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={bookTitleStyle}>{book.title}</div>
        <span style={{ ...subjectTagStyle, background: sub.bg, color: sub.color }}>{sub.label}</span>
        {progress !== null && (
          <div style={{ marginTop: 8 }}>
            <div style={progressBarBgStyle}>
              <div style={{ ...progressBarFillStyle, width: `${progress}%`, background: book.cover_color }} />
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{progress}%</div>
          </div>
        )}
        {book.exercise_count > 0 && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>演習 {book.exercise_count}回</div>
        )}
      </div>
      <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
    </Link>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const innerStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "24px 18px 120px", display: "grid", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 999, background: "#0F172A", color: "#fff", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer" };

const searchBoxStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: "#fff", border: "1px solid #E2E8F0" };
const searchInputStyle: CSSProperties = { flex: 1, border: "none", outline: "none", fontSize: 15, color: "#0F172A", background: "transparent", fontFamily: "inherit" };

const filterRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const filterBtnStyle: CSSProperties = { padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" };

const emptyStyle: CSSProperties = { textAlign: "center", padding: "40px 0", color: "#94A3B8" };
const emptyCardStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", borderRadius: 24, background: "#fff", border: "1px solid #E2E8F0" };

const groupHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 };
const subjectTagStyle: CSSProperties = { display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 };

const bookGridStyle: CSSProperties = { display: "grid", gap: 10, marginBottom: 20 };
const bookCardStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 20, background: "#fff", border: "1px solid #E2E8F0", textDecoration: "none" };
const bookCoverStyle: CSSProperties = { width: 52, height: 68, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0 };
const bookTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 700, color: "#0F172A", lineHeight: 1.3, marginBottom: 4 };
const progressBarBgStyle: CSSProperties = { height: 4, borderRadius: 999, background: "#F1F5F9", overflow: "hidden" };
const progressBarFillStyle: CSSProperties = { height: "100%", borderRadius: 999, transition: "width 0.3s ease" };

// Modal
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 };
const modalStyle: CSSProperties = { position: "fixed", left: 0, right: 0, bottom: 0, top: "20%", zIndex: 201, background: "#fff", borderRadius: "24px 24px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" };
const modalHandleStyle: CSSProperties = { width: 36, height: 4, borderRadius: 999, background: "#E2E8F0", margin: "12px auto 0", flexShrink: 0 };
const modalHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 8px", flexShrink: 0 };
const closeBtnStyle: CSSProperties = { background: "#F1F5F9", border: "none", borderRadius: 999, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#475569" };
const modalBodyStyle: CSSProperties = { flex: 1, overflowY: "auto", padding: "8px 20px 40px", display: "grid", gap: 12 };
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: "#475569" };
const modalInputStyle: CSSProperties = { padding: "13px 14px", borderRadius: 14, border: "1.5px solid #E2E8F0", fontSize: 15, color: "#0F172A", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const subjectGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 };
const subjectBtnStyle: CSSProperties = { padding: "10px 0", borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const modalSaveBtnStyle: CSSProperties = { padding: "15px", borderRadius: 16, background: "#0F172A", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", marginTop: 8 };
