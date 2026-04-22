"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { SUBJECT_BG, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";
import { AlertTriangle, BookMarked, BookOpen, Check, ClipboardList, GraduationCap, Library, Plus, Trash2 } from "lucide-react";

type BookStats = {
  attempted: number;
  perfect: number;
  unsure: number;
  checked: number;
  wrong: number;
  mastery: number;
  coverage: number;
};

type ShelfItem = {
  id: string;
  book_id: string;
  added_at: string;
  book: {
    id: string;
    title: string;
    subject: string;
    level: number;
    level_label: string;
    total_problems: number;
    category: string;
    cover_url: string | null;
  } | null;
  stats: BookStats;
};

const SUBJECT_TABS = [
  { value: "", label: "すべて" },
  { value: "math", label: "数学" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "english", label: "英語" },
  { value: "japanese", label: "国語" },
  { value: "world_history", label: "世界史" },
  { value: "japanese_history", label: "日本史" },
  { value: "geography", label: "地理" },
  { value: "civics", label: "公民" },
  { value: "information", label: "情報" },
  { value: "other", label: "その他" },
] as const;

const CATEGORY_TABS = [
  { value: "", label: "すべて" },
  { value: "教科書", label: "教科書" },
  { value: "問題集", label: "問題集" },
  { value: "その他", label: "その他" },
] as const;

function normalizeCategory(cat: string): string {
  return cat === "テスト" ? "その他" : cat;
}

export default function ShelfPage() {
  const router = useRouter();
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    fetch("/api/shelf")
      .then((res) => res.json())
      .then((data) => {
        setShelf(data.shelf ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return shelf.filter((item) => {
      if (filterSubject && item.book?.subject !== filterSubject) return false;
      if (filterCategory && normalizeCategory(item.book?.category ?? "") !== filterCategory) return false;
      return true;
    });
  }, [filterSubject, filterCategory, shelf]);

  const handleRemove = async (shelfId: string) => {
    setRemoving(shelfId);
    await fetch("/api/shelf", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelfId }),
    });
    setShelf((prev) => prev.filter((item) => item.id !== shelfId));
    setRemoving(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}><div style={spinnerStyle} /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Shelf</p>
            <h1 style={titleStyle}>いま使っている教材を一目で管理する</h1>
            <p style={descriptionStyle}>
              本棚に入れた教材ごとに、どこまで進んだか、理解率がどのくらいか、次に何をするかを見やすくまとめています。
            </p>
          </div>
          <Link href="/books" style={primaryLinkStyle}>
            <Plus size={14} />
            教材を追加する
          </Link>
        </section>

        <section style={summaryGridStyle}>
          <SummaryCard label="本棚の冊数" value={String(shelf.length)} sub="いま使っている教材" />
          <SummaryCard
            label="平均理解率"
            value={`${shelf.length ? Math.round(shelf.reduce((sum, item) => sum + item.stats.mastery, 0) / shelf.length) : 0}%`}
            sub="解いた問題のうち理解できた割合"
          />
          <SummaryCard
            label="進めた問題数"
            value={String(shelf.reduce((sum, item) => sum + item.stats.attempted, 0))}
            sub="本棚の教材で記録した問題"
          />
        </section>

        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={sectionEyebrowStyle}>My Shelf</p>
              <h2 style={sectionTitleStyle}>教材一覧</h2>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORY_TABS.map((tab) => {
                const count = tab.value === "" ? shelf.length : shelf.filter((item) => normalizeCategory(item.book?.category ?? "") === tab.value).length;
                if (tab.value !== "" && count === 0) return null;
                return (
                  <button key={tab.value} onClick={() => setFilterCategory(tab.value)} style={filterButtonStyle(filterCategory === tab.value)}>
                    {tab.label}
                    <span style={filterCountStyle(filterCategory === tab.value)}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SUBJECT_TABS.map((tab) => {
                const count = tab.value === "" ? shelf.length : shelf.filter((item) => item.book?.subject === tab.value).length;
                if (tab.value !== "" && count === 0) return null;
                return (
                  <button key={tab.value} onClick={() => setFilterSubject(tab.value)} style={filterButtonStyle(filterSubject === tab.value)}>
                    {tab.label}
                    <span style={filterCountStyle(filterSubject === tab.value)}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {shelf.length === 0 ? (
            <div style={emptyStateStyle}>
              <Library size={40} color="var(--border-light)" />
              <div>
                <p style={{ margin: "10px 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>本棚はまだ空です</p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  使う教材を追加して、理解率や進み具合をまとめて見られるようにしましょう。
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStateStyle}>
              <AlertTriangle size={36} color="#F79009" />
              <div>
                <p style={{ margin: "10px 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>この科目の教材はまだありません</p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                  別の科目に切り替えるか、新しい教材を本棚に追加してください。
                </p>
              </div>
            </div>
          ) : (
            <div style={shelfGridStyle}>
              {filtered.map((item) => {
                const book = item.book;
                if (!book) return null;
                const subjectColor = SUBJECT_COLOR[book.subject] ?? "#667085";
                return (
                  <article key={item.id} style={bookCardStyle(subjectColor)}>
                    <div style={{ display: "grid", gap: 14 }}>
                      <div style={coverWrapStyle}>
                        {book.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={book.cover_url} alt={book.title} style={coverStyle} />
                        ) : (
                          <div style={coverFallbackStyle(subjectColor)}>
                            {normalizeCategory(book.category) === "その他"
                              ? <GraduationCap size={28} color={subjectColor} />
                              : <BookMarked size={28} color={subjectColor} />}
                            <span style={{ fontSize: 12, fontWeight: 800 }}>
                              {normalizeCategory(book.category) === "その他" ? "その他" : `Lv.${book.level}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span style={categoryBadgeStyle(normalizeCategory(book.category))}>{normalizeCategory(book.category)}</span>
                        <span style={subjectBadgeStyle(book.subject)}>{SUBJECT_LABEL[book.subject] ?? book.subject}</span>
                        {normalizeCategory(book.category) !== "その他" && (
                          <span style={softBadgeStyle}>Lv.{book.level}</span>
                        )}
                        <span style={softBadgeStyle}>{book.total_problems}問</span>
                      </div>

                      <div>
                        <p style={bookTitleStyle}>{book.title}</p>
                        <p style={bookSubStyle}>追加日 {new Date(item.added_at).toLocaleDateString("ja-JP")}</p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <MetricBar label="理解率" value={`${item.stats.mastery}%`} width={item.stats.mastery} color={subjectColor} />
                      <MetricBar label="進捗" value={`${item.stats.attempted}/${book.total_problems}問`} width={item.stats.coverage} color="#667085" />
                    </div>

                    <div style={miniStatsGridStyle}>
                      <MiniStat label="理解" value={item.stats.perfect} tone="#12B76A" icon={<Check size={13} />} />
                      <MiniStat label="不安" value={item.stats.unsure} tone="#F79009" icon={<AlertTriangle size={13} />} />
                      <MiniStat label="確認" value={item.stats.checked} tone="#175CD3" icon={<BookOpen size={13} />} />
                      <MiniStat label="苦戦" value={item.stats.wrong} tone="#D92D20" icon={<AlertTriangle size={13} />} />
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <button onClick={() => router.push(`/shelf/${book.id}`)} style={primaryButtonStyle}>
                        <ClipboardList size={14} />
                        演習シートを開く
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Link href="/practice" style={secondaryLinkStyle}>
                          演習へ
                        </Link>
                        <button onClick={() => handleRemove(item.id)} disabled={removing === item.id} style={removeButtonStyle}>
                          <Trash2 size={13} />
                          {removing === item.id ? "削除中..." : "外す"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={summaryCardStyle}>
      <p style={summaryLabelStyle}>{label}</p>
      <p style={summaryValueStyle}>{value}</p>
      <p style={summarySubStyle}>{sub}</p>
    </div>
  );
}

function MetricBar({ label, value, width, color }: { label: string; value: string; width: number; color: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--bg-elevated)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, width))}%`, background: `linear-gradient(90deg, ${color}, ${color}AA)`, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, background: `${tone}12`, padding: "10px 8px", display: "grid", gap: 4, justifyItems: "center" }}>
      <div style={{ color: tone }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: tone }}>{value}</p>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{label}</p>
    </div>
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "24px 16px 88px", display: "grid", gap: 18 };
const heroStyle: React.CSSProperties = { display: "grid", gap: 14, gridTemplateColumns: "1fr auto", alignItems: "end", background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)", border: "1px solid var(--border)", borderRadius: 24, padding: "24px 24px 20px" };
const eyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" };
const titleStyle: React.CSSProperties = { margin: "6px 0 8px", fontSize: 28, lineHeight: 1.2, fontWeight: 800, color: "var(--text-primary)" };
const descriptionStyle: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)", maxWidth: 740 };
const primaryLinkStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "linear-gradient(135deg, var(--accent), #5B73D4)", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 800, textDecoration: "none" };

const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const summaryCardStyle: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px 18px", display: "grid", gap: 4 };
const summaryLabelStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" };
const summaryValueStyle: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: "var(--text-primary)" };
const summarySubStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-secondary)" };

const cardStyle: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 18, display: "grid", gap: 16 };
const sectionEyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" };
const sectionTitleStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" };

const filterButtonStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: active ? "none" : "1px solid var(--border)", background: active ? "var(--accent)" : "var(--bg-card)", color: active ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 800, cursor: "pointer" });
const filterCountStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: active ? "rgba(255,255,255,0.22)" : "var(--bg-elevated)", color: active ? "#fff" : "var(--text-secondary)", fontSize: 10, fontWeight: 800 });

const shelfGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };
const bookCardStyle = (subjectColor: string): React.CSSProperties => ({ border: `1px solid ${subjectColor}1F`, borderRadius: 20, background: "#fff", padding: 16, display: "grid", gap: 14 });
const coverWrapStyle: React.CSSProperties = { width: "100%", aspectRatio: "3 / 4", borderRadius: 16, overflow: "hidden", background: "var(--bg-elevated)", border: "1px solid var(--border)" };
const coverStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const coverFallbackStyle = (subjectColor: string): React.CSSProperties => ({ width: "100%", height: "100%", display: "grid", placeItems: "center", gap: 8, color: subjectColor, background: `${subjectColor}10` });
const categoryBadgeStyle = (category: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800,
  background: category === "教科書" ? "#FFF7ED" : category === "問題集" ? "#EEF4FF" : "#F5F3FF",
  color: category === "教科書" ? "#C2410C" : category === "問題集" ? "#1D4ED8" : "#7C3AED",
});
const subjectBadgeStyle = (subject: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: SUBJECT_BG[subject] ?? "var(--bg-elevated)", color: SUBJECT_COLOR[subject] ?? "var(--text-secondary)", fontSize: 11, fontWeight: 800 });
const softBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 800 };
const bookTitleStyle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.5 };
const bookSubStyle: React.CSSProperties = { margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" };
const miniStatsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 };

const primaryButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", background: "linear-gradient(135deg, var(--accent), #5B73D4)", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--accent)", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 800, textDecoration: "none" };
const removeButtonStyle: React.CSSProperties = { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer" };

const emptyStateStyle: React.CSSProperties = { minHeight: 220, borderRadius: 18, background: "var(--bg-elevated)", display: "grid", placeItems: "center", textAlign: "center", padding: "24px 28px" };
const loadingWrapStyle: React.CSSProperties = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" };
const spinnerStyle: React.CSSProperties = { width: 36, height: 36, border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
