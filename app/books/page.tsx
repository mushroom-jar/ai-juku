"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";
import { Atom, BookMarked, BookOpen, BookText, Check, FlaskConical, Globe, ImagePlus, Landmark, Leaf, Lock, Map, Plus, School, Search, Sigma, Users, X } from "lucide-react";

type Book = {
  id: string;
  title: string;
  subject: string;
  level: number;
  level_label: string;
  category: string;
  total_problems: number;
  source: "official" | "community" | "private" | "school";
  use_count: number;
  cover_url: string | null;
  school_name: string | null;
};

const SUBJECT_OPTIONS = [
  { value: "math", label: "数学", Icon: Sigma },
  { value: "physics", label: "物理", Icon: Atom },
  { value: "chemistry", label: "化学", Icon: FlaskConical },
  { value: "biology", label: "生物", Icon: Leaf },
  { value: "english", label: "英語", Icon: BookText },
  { value: "japanese", label: "国語", Icon: BookOpen },
  { value: "world_history", label: "世界史", Icon: Globe },
  { value: "japanese_history", label: "日本史", Icon: Landmark },
  { value: "geography", label: "地理", Icon: Map },
  { value: "civics", label: "公民", Icon: Users },
  { value: "information", label: "情報", Icon: School },
  { value: "other", label: "その他", Icon: BookMarked },
] as const;

const LEVEL_OPTIONS = [
  { value: 1, label: "Lv.1", sub: "基礎固め" },
  { value: 2, label: "Lv.2", sub: "共通テスト・標準私大" },
  { value: 3, label: "Lv.3", sub: "MARCH・関関同立" },
  { value: 4, label: "Lv.4", sub: "地方国公立・難関私大" },
  { value: 5, label: "Lv.5", sub: "最難関" },
] as const;

const CATEGORY_OPTIONS = [
  {
    value: "教科書",
    label: "教科書",
    description: "授業理解や通読のための教材",
    sharing: "全世界で共有",
  },
  {
    value: "問題集",
    label: "問題集",
    description: "演習を重ねて力をつける教材",
    sharing: "全世界で共有",
  },
  {
    value: "テスト・模試",
    label: "テスト・模試",
    description: "定期テスト・模試の記録と成績管理",
    sharing: "自分のみ",
  },
  {
    value: "その他",
    label: "その他",
    description: "学校の課題・自作問題など",
    sharing: "学校内 or 自分のみ",
  },
] as const;

type Category = typeof CATEGORY_OPTIONS[number]["value"];

function normalizeCategory(cat: string): Category {
  if (cat === "テスト") return "テスト・模試";
  if (cat === "教科書" || cat === "問題集" || cat === "テスト・模試" || cat === "その他") return cat;
  return "問題集";
}

function sourceLabel(source: Book["source"]): string {
  if (source === "official") return "永愛塾のおすすめ教材";
  if (source === "community") return "全体公開の教材";
  if (source === "school") return "学校内で共有";
  return "自分だけの教材";
}

export default function BooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCategory, setFilterCategory] = useState<Category | "">("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shelfIds, setShelfIds] = useState<Set<string>>(new Set());
  const [addingShelf, setAddingShelf] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [studentSchoolName, setStudentSchoolName] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subject: "math",
    category: "問題集" as Category,
    level: 2,
    total_problems: 0,
    cover_url: "",
    visibility: "school" as "school" | "private",
  });

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set("subject", filterSubject);
    if (filterLevel) params.set("level", filterLevel);
    if (filterCategory) params.set("category", filterCategory);
    if (query) params.set("q", query);
    const res = await fetch(`/api/books?${params.toString()}`);
    const data = await res.json();
    setBooks(data.books ?? []);
    if (data.meta?.school_name) setStudentSchoolName(data.meta.school_name);
    setLoading(false);
  }, [filterCategory, filterLevel, filterSubject, query]);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchBooks(), 0);
    return () => window.clearTimeout(id);
  }, [fetchBooks]);

  useEffect(() => {
    fetch("/api/shelf")
      .then((r) => r.json())
      .then((d) => setShelfIds(new Set((d.shelf ?? []).map((item: { book_id: string }) => item.book_id))));
  }, []);

  const filteredCount = useMemo(() => books.length, [books]);

  const categorySummary = useMemo(
    () =>
      CATEGORY_OPTIONS.map((cat) => ({
        ...cat,
        count: books.filter((b) => normalizeCategory(b.category) === cat.value).length,
      })),
    [books]
  );

  const groupedBooks = useMemo(
    () =>
      CATEGORY_OPTIONS.map((cat) => ({
        ...cat,
        items: books.filter((b) => normalizeCategory(b.category) === cat.value),
      })).filter((g) => g.items.length > 0),
    [books]
  );

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void fetchBooks();
  };

  const handleAddShelf = async (bookId: string) => {
    setAddingShelf(bookId);
    await fetch("/api/shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    setShelfIds((prev) => new Set([...prev, bookId]));
    setAddingShelf(null);
  };

  const handleCoverSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
    setUploadingCover(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/books/cover", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setForm((prev) => ({ ...prev, cover_url: data.url }));
    setUploadingCover(false);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.total_problems) return;
    setSubmitting(true);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        subject: form.subject,
        category: form.category,
        level: form.category !== "その他" ? form.level : undefined,
        total_problems: form.total_problems,
        cover_url: form.cover_url || undefined,
        visibility: form.category === "その他" ? form.visibility : undefined,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ title: "", subject: "math", category: "問題集", level: 2, total_problems: 0, cover_url: "", visibility: "school" });
      setCoverPreview(null);
      void fetchBooks();
    }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Books</p>
            <h1 style={titleStyle}>教材を探して、すぐ演習へつなぐ</h1>
            <p style={descriptionStyle}>
              教科書・問題集は全体公開、学校の課題や自作問題は学校内で共有できます。
            </p>
          </div>
          <div style={heroActionsStyle}>
            <button onClick={() => setShowForm((prev) => !prev)} style={primaryButtonStyle}>
              <Plus size={14} />
              教材を追加
            </button>
          </div>
        </section>

        {/* カテゴリカード */}
        <section style={searchCardStyle}>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <p style={sectionEyebrowStyle}>Category</p>
              <h2 style={sectionTitleStyle}>3つのカテゴリから選ぶ</h2>
            </div>
            <div style={categoryGridStyle}>
              <button onClick={() => setFilterCategory("")} style={categoryCardStyle(filterCategory === "", false)}>
                <span style={categoryTitleStyle}>すべて</span>
                <span style={categoryCountStyle}>{filteredCount}件</span>
                <span style={categoryTextStyle}>全カテゴリを一覧表示します。</span>
              </button>
              {categorySummary.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  style={categoryCardStyle(filterCategory === cat.value, cat.value === "その他")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={categoryTitleStyle}>{cat.label}</span>
                    <span style={sharingPillStyle(cat.value)}>
                      {cat.value === "その他" ? <School size={10} /> : <Globe size={10} />}
                      {cat.sharing}
                    </span>
                  </div>
                  <span style={categoryCountStyle}>{cat.count}件</span>
                  <span style={categoryTextStyle}>{cat.description}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearch} style={searchFormStyle}>
            <div style={searchInputWrapStyle}>
              <Search size={16} color="var(--text-muted)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="教材名で検索"
                style={searchInputStyle}
              />
            </div>
            <button type="submit" style={secondaryAccentButtonStyle}>検索する</button>
          </form>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setFilterSubject("")} style={filterButtonStyle(filterSubject === "")}>すべての科目</button>
              {SUBJECT_OPTIONS.map(({ value, label, Icon }) => (
                <button key={value} onClick={() => setFilterSubject(value)} style={filterButtonStyle(filterSubject === value)}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setFilterLevel("")} style={filterButtonStyle(filterLevel === "")}>すべてのレベル</button>
              {LEVEL_OPTIONS.map((lv) => (
                <button key={lv.value} onClick={() => setFilterLevel(String(lv.value))} style={filterButtonStyle(filterLevel === String(lv.value))}>
                  {lv.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 追加フォーム */}
        {showForm && (
          <section style={formCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={sectionEyebrowStyle}>Add Book</p>
                <h2 style={sectionTitleStyle}>新しい教材を追加</h2>
              </div>
              <button onClick={() => setShowForm(false)} style={ghostButtonStyle}>閉じる</button>
            </div>

            <form onSubmit={handleRegister} style={{ display: "grid", gap: 14 }}>
              {/* カテゴリ */}
              <div style={{ display: "grid", gap: 8 }}>
                <span style={labelStyle}>カテゴリ</span>
                <div style={{ display: "grid", gap: 8 }}>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category: cat.value }))}
                      style={categoryOptionStyle(form.category === cat.value, cat.value === "その他")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "inherit" }}>{cat.label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{cat.description}</span>
                      </div>
                      <span style={sharingPillStyle(cat.value)}>
                        {cat.value === "その他" ? <School size={10} /> : <Globe size={10} />}
                        {cat.sharing}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 公開範囲（その他のみ） */}
              {form.category === "その他" && (
                <div style={visibilityBoxStyle}>
                  <span style={labelStyle}>公開範囲</span>
                  {!studentSchoolName && (
                    <p style={{ margin: 0, fontSize: 12, color: "#B45309", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px" }}>
                      学校内共有には、設定画面で学校名の登録が必要です。
                    </p>
                  )}
                  <div style={{ display: "grid", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, visibility: "school" }))}
                      style={visibilityOptionStyle(form.visibility === "school")}
                    >
                      <School size={15} style={{ flexShrink: 0 }} />
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>学校内で共有</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          {studentSchoolName ? `${studentSchoolName} の生徒に公開されます` : "学校名を設定すると有効になります"}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, visibility: "private" }))}
                      style={visibilityOptionStyle(form.visibility === "private")}
                    >
                      <Lock size={15} style={{ flexShrink: 0 }} />
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>自分だけ</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>他の人には見えません</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* 教材名 */}
              <label style={fieldWrapStyle}>
                <span style={labelStyle}>教材名</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={form.category === "その他" ? "例: 数学 中間テスト 2024前期" : "例: 青チャート 数学IA"}
                  required
                  style={inputStyle}
                />
              </label>

              {/* 科目 */}
              <div style={{ display: "grid", gap: 8 }}>
                <span style={labelStyle}>科目</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SUBJECT_OPTIONS.map(({ value, label, Icon }) => (
                    <button key={value} type="button" onClick={() => setForm({ ...form, subject: value })} style={selectChipStyle(form.subject === value)}>
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 教材レベル（その他は不要） */}
              {form.category !== "その他" && (
                <div style={{ display: "grid", gap: 8 }}>
                  <span style={labelStyle}>教材レベル</span>
                  <div style={{ display: "grid", gap: 8 }}>
                    {LEVEL_OPTIONS.map((lv) => (
                      <button key={lv.value} type="button" onClick={() => setForm({ ...form, level: lv.value })} style={levelOptionStyle(form.level === lv.value)}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>{lv.label}</span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lv.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 問題数 */}
              <label style={fieldWrapStyle}>
                <span style={labelStyle}>問題数</span>
                <input
                  type="number"
                  min={1}
                  value={form.total_problems || ""}
                  onChange={(e) => setForm({ ...form, total_problems: Number(e.target.value) || 0 })}
                  placeholder="例: 120"
                  required
                  style={inputStyle}
                />
              </label>

              {/* 表紙画像 */}
              <div style={{ display: "grid", gap: 8 }}>
                <span style={labelStyle}>表紙画像（任意）</span>
                {coverPreview ? (
                  <div style={coverPreviewWrapStyle}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreview} alt="cover preview" style={coverImageStyle} />
                    <div style={{ display: "grid", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: uploadingCover ? "var(--text-secondary)" : "#027A48", fontWeight: 700 }}>
                        {uploadingCover ? "アップロード中..." : "画像を設定しました"}
                      </p>
                      <button type="button" onClick={() => { setCoverPreview(null); setForm((prev) => ({ ...prev, cover_url: "" })); }} style={ghostButtonStyle}>
                        <X size={13} />削除する
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={uploadDropStyle}>
                    <ImagePlus size={16} />
                    JPEG / PNG / WebP を追加
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverSelect} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setShowForm(false)} style={ghostButtonStyle}>キャンセル</button>
                <button type="submit" disabled={submitting || uploadingCover} style={primaryButtonStyle}>
                  {submitting ? "追加中..." : "教材を追加する"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* 教材一覧 */}
        <section style={booksSectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={sectionEyebrowStyle}>Library</p>
              <h2 style={sectionTitleStyle}>教材一覧</h2>
            </div>
            <span style={countPillStyle}>{filteredCount}件</span>
          </div>

          {loading ? (
            <div style={loadingWrapStyle}><div style={spinnerStyle} /></div>
          ) : books.length === 0 ? (
            <div style={emptyStateStyle}>
              <BookOpen size={38} color="var(--border-light)" />
              <div>
                <p style={{ margin: "10px 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>教材が見つかりません</p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  条件を変えて探すか、新しい教材を追加しましょう。
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {groupedBooks.map((group) => (
                <section key={group.value} style={{ display: "grid", gap: 12 }}>
                  <div style={categorySectionHeadStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{group.label}</h3>
                        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{group.description}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={sharingPillStyle(group.value)}>
                        {group.value === "その他" ? <School size={10} /> : <Globe size={10} />}
                        {group.value === "その他" ? "学校内 / 自分のみ" : "全体公開"}
                      </span>
                      <span style={countPillStyle}>{group.items.length}件</span>
                    </div>
                  </div>

                  <div style={booksGridStyle}>
                    {group.items.map((book) => {
                      const subjectColor = SUBJECT_COLOR[book.subject] ?? "#667085";
                      const inShelf = shelfIds.has(book.id);
                      return (
                        <article key={book.id} style={bookCardStyle(subjectColor)}>
                          <div style={{ display: "grid", gap: 12 }}>
                            <div style={coverWrapStyle}>
                              {book.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={book.cover_url} alt={book.title} style={coverStyle} />
                              ) : (
                                <div style={coverFallbackStyle(subjectColor)}>
                                  <BookOpen size={24} color={subjectColor} />
                                  <span style={{ fontSize: 12, fontWeight: 800 }}>{group.label}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              <span style={categoryBadgeStyle(group.value)}>{group.label}</span>
                              <span style={subjectBadgeStyle(subjectColor)}>{SUBJECT_LABEL[book.subject] ?? book.subject}</span>
                              {book.source !== "school" && book.source !== "private" && (
                                <span style={softBadgeStyle}>Lv.{book.level}</span>
                              )}
                              <span style={softBadgeStyle}>{book.total_problems}問</span>
                            </div>

                            <div>
                              <p style={bookTitleStyle}>{book.title}</p>
                              <p style={bookSubStyle}>
                                {sourceLabel(book.source)}
                                {book.source === "school" && book.school_name ? ` · ${book.school_name}` : ""}
                                {book.source === "community" && book.use_count > 0 ? ` · ${book.use_count}人が使用中` : ""}
                              </p>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            <button onClick={() => router.push(`/books/${book.id}/practice`)} style={primaryButtonStyle}>
                              演習を始める
                            </button>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => router.push(`/books/${book.id}/record`)} style={secondaryAccentButtonStyle}>
                                記録する
                              </button>
                              <button
                                onClick={() => !inShelf && handleAddShelf(book.id)}
                                disabled={inShelf || addingShelf === book.id}
                                style={shelfButtonStyle(inShelf)}
                              >
                                {inShelf ? <Check size={13} /> : <BookMarked size={13} />}
                                {inShelf ? "本棚に追加済み" : addingShelf === book.id ? "追加中..." : "本棚へ"}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "24px 16px 88px",
  display: "grid",
  gap: 18,
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "1fr auto",
  alignItems: "end",
  background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  padding: "24px 24px 20px",
};

const eyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" };
const titleStyle: React.CSSProperties = { margin: "6px 0 8px", fontSize: 28, lineHeight: 1.2, fontWeight: 800, color: "var(--text-primary)" };
const descriptionStyle: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)", maxWidth: 720 };
const heroActionsStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" };

const searchCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 14,
};

const categoryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const categoryCardStyle = (active: boolean, isOther: boolean): React.CSSProperties => ({
  display: "grid",
  gap: 6,
  padding: "14px 16px",
  borderRadius: 18,
  border: active ? `1px solid ${isOther ? "#7C3AED" : "var(--accent)"}` : "1px solid var(--border)",
  background: active ? (isOther ? "linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 100%)" : "linear-gradient(180deg, #F8FAFF 0%, #EEF4FF 100%)") : "#fff",
  textAlign: "left",
  cursor: "pointer",
});

const categoryTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: "var(--text-primary)" };
const categoryCountStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "var(--accent)" };
const categoryTextStyle: React.CSSProperties = { fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" };

const sharingPillStyle = (category: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  background: category === "その他" ? "#F5F3FF" : "#EEF4FF",
  color: category === "その他" ? "#7C3AED" : "#1D4ED8",
  border: `1px solid ${category === "その他" ? "#DDD6FE" : "#BFDBFE"}`,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
});

const searchFormStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: 10 };
const searchInputWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "0 12px" };
const searchInputStyle: React.CSSProperties = { width: "100%", border: "none", background: "transparent", outline: "none", padding: "12px 0", fontSize: 14, color: "var(--text-primary)" };

const formCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--accent)",
  borderRadius: 20,
  padding: 20,
  display: "grid",
  gap: 16,
  boxShadow: "0 12px 30px rgba(49, 87, 183, 0.08)",
};

const sectionEyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" };
const sectionTitleStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" };
const fieldWrapStyle: React.CSSProperties = { display: "grid", gap: 8 };
const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--bg-elevated)" };

const categoryOptionStyle = (active: boolean, isOther: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: active ? `1px solid ${isOther ? "#7C3AED" : "var(--accent)"}` : "1px solid var(--border)",
  background: active ? (isOther ? "#F5F3FF" : "var(--accent-light, #EEF1F8)") : "var(--bg-elevated)",
  color: active ? (isOther ? "#7C3AED" : "var(--accent)") : "var(--text-primary)",
  cursor: "pointer",
});

const visibilityBoxStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#FAFAFA",
  border: "1px solid var(--border)",
  display: "grid",
  gap: 10,
};

const visibilityOptionStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: active ? "1px solid #7C3AED" : "1px solid var(--border)",
  background: active ? "#F5F3FF" : "#fff",
  color: active ? "#7C3AED" : "var(--text-primary)",
  cursor: "pointer",
  textAlign: "left",
});

const selectChipStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
  background: active ? "var(--accent-light, #EEF1F8)" : "var(--bg-card)",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});

const levelOptionStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
  background: active ? "var(--accent-light, #EEF1F8)" : "var(--bg-elevated)",
  cursor: "pointer",
});

const uploadDropStyle: React.CSSProperties = {
  minHeight: 120,
  border: "2px dashed var(--border)",
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  gap: 8,
  background: "var(--bg-elevated)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text-secondary)",
  cursor: "pointer",
  padding: 18,
  textAlign: "center",
};

const coverPreviewWrapStyle: React.CSSProperties = { display: "flex", gap: 14, alignItems: "flex-start" };
const coverImageStyle: React.CSSProperties = { width: 84, height: 116, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" };

const booksSectionStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 16,
};

const countPillStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, border: "1px solid var(--border)" };
const categorySectionHeadStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };

const booksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 14,
};

const bookCardStyle = (subjectColor: string): React.CSSProperties => ({
  border: `1px solid ${subjectColor}1F`,
  borderRadius: 20,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 14,
});

const coverWrapStyle: React.CSSProperties = { width: "100%", aspectRatio: "3 / 4", borderRadius: 16, overflow: "hidden", background: "var(--bg-elevated)", border: "1px solid var(--border)" };
const coverStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const coverFallbackStyle = (subjectColor: string): React.CSSProperties => ({ width: "100%", height: "100%", display: "grid", placeItems: "center", gap: 8, color: subjectColor, background: `${subjectColor}10` });
const subjectBadgeStyle = (subjectColor: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: `${subjectColor}12`, color: subjectColor, fontSize: 11, fontWeight: 800 });
const softBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 800 };
const categoryBadgeStyle = (category: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  background: category === "教科書" ? "#FFF7ED" : category === "問題集" ? "#EEF4FF" : "#F5F3FF",
  color: category === "教科書" ? "#C2410C" : category === "問題集" ? "#1D4ED8" : "#7C3AED",
  fontSize: 11,
  fontWeight: 800,
});
const bookTitleStyle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.5 };
const bookSubStyle: React.CSSProperties = { margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 };

const emptyStateStyle: React.CSSProperties = { minHeight: 220, borderRadius: 18, background: "var(--bg-elevated)", display: "grid", placeItems: "center", textAlign: "center", padding: "24px 28px" };
const loadingWrapStyle: React.CSSProperties = { minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" };

const primaryButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "linear-gradient(135deg, var(--accent), #5B73D4)", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" };
const secondaryAccentButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--accent)", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" };
const ghostButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const shelfButtonStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${active ? "#ABEFC6" : "var(--border)"}`, background: active ? "#ECFDF3" : "#fff", color: active ? "#027A48" : "var(--text-secondary)", padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: active ? "default" : "pointer", flex: 1 });
const filterButtonStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: active ? "none" : "1px solid var(--border)", background: active ? "var(--accent)" : "var(--bg-card)", color: active ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 800, cursor: "pointer" });

const spinnerStyle: React.CSSProperties = { width: 36, height: 36, border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
