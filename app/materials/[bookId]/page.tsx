"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import {
  Star, BookOpen, Users, Clock, Copy, Check,
  ChevronRight, AlertCircle, Trash2, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type Book = {
  id: string; title: string; subject: string; category: string;
  due_date: string | null; description: string | null;
  total_problems: number; problem_labels: string[];
  school_name: string | null; source: string; use_count: number;
};
type ProblemStat = { total: number; correct: number; wrong: number; partial: number };
type Review = {
  id: string; rating: number; difficulty: number | null; comment: string | null;
  created_at: string; students: { name: string } | null;
};
type ExerciseRecord = {
  id: string; date: string; subject: string; material: string;
  range: string; question_count: number; correct_count: number; duration: number;
};

const SUBJECT_LABEL: Record<string, string> = {
  math: "数学", physics: "物理", chemistry: "化学", biology: "生物",
  english: "英語", japanese: "国語", world_history: "世界史",
  japanese_history: "日本史", geography: "地理", civics: "公民",
  information: "情報", other: "その他",
};
const SUBJECT_COLOR: Record<string, string> = {
  math: "#2563EB", physics: "#E11D48", chemistry: "#0891B2", biology: "#059669",
  english: "#7C3AED", japanese: "#D97706", world_history: "#B45309",
  japanese_history: "#A16207", geography: "#0F766E", civics: "#475569",
  information: "#4F46E5", other: "#64748B",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function pctColor(p: number) {
  if (p >= 75) return "#059669"; if (p >= 50) return "#3157B7"; if (p >= 25) return "#B45309"; return "#DC2626";
}

// ── Main ──────────────────────────────────────────────────────────
export default function MaterialPage() {
  const params = useParams();
  const bookId = params.bookId as string;
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [stats, setStats] = useState<{ totalStudents: number; problemStats: Record<number, ProblemStat> }>({ totalStudents: 0, problemStats: {} });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [publicExercises, setPublicExercises] = useState<ExerciseRecord[]>([]);
  const [inShelf, setInShelf] = useState(false);
  const [loading, setLoading] = useState(true);

  const [copied, setCopied] = useState(false);
  const [addingShelf, setAddingShelf] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewDifficulty, setReviewDifficulty] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    fetch(`/api/materials/${bookId}`)
      .then(r => r.json())
      .then(d => {
        setBook(d.book ?? null);
        setStats(d.stats ?? { totalStudents: 0, problemStats: {} });
        setReviews(d.reviews ?? []);
        setMyReview(d.myReview ?? null);
        setPublicExercises(d.publicExercises ?? []);
        setInShelf(d.inShelf ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  const copyUrl = () => {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addToShelf = async () => {
    setAddingShelf(true);
    await fetch(`/api/materials/${bookId}/shelf`, { method: "POST" });
    setInShelf(true);
    setAddingShelf(false);
  };

  const saveReview = async () => {
    if (!reviewRating) return;
    setSavingReview(true);
    const res = await fetch(`/api/materials/${bookId}/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: reviewRating, difficulty: reviewDifficulty || null, comment: reviewComment || null }),
    });
    const data = await res.json();
    if (data.review) {
      const newReview = { ...data.review, students: null };
      setMyReview(newReview);
      setReviews(prev => {
        const filtered = prev.filter(r => r.id !== data.review.id);
        return [newReview, ...filtered];
      });
    }
    setSavingReview(false);
    setShowReviewForm(false);
  };

  const deleteReview = async () => {
    if (!myReview) return;
    await fetch(`/api/materials/${bookId}/reviews`, { method: "DELETE" });
    setMyReview(null);
    setReviews(prev => prev.filter(r => r.id !== myReview.id));
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  if (!book) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "80px 16px", color: "#94A3B8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>教材が見つかりません</div>
        </div>
      </AppLayout>
    );
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const avgDifficulty = reviews.filter(r => r.difficulty != null).length
    ? reviews.filter(r => r.difficulty != null).reduce((s, r) => s + (r.difficulty ?? 0), 0) / reviews.filter(r => r.difficulty != null).length : null;
  const subjectColor = SUBJECT_COLOR[book.subject] ?? "#64748B";

  const problemEntries = Object.entries(stats.problemStats)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const worstProblems = [...problemEntries]
    .sort((a, b) => {
      const aRate = a[1].total ? a[1].correct / a[1].total : 1;
      const bRate = b[1].total ? b[1].correct / b[1].total : 1;
      return aRate - bRate;
    })
    .slice(0, 5);

  return (
    <AppLayout>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 100px" }}>

        {/* ─ ヘッダー ─ */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${subjectColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BookOpen size={22} color={subjectColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: subjectColor, background: `${subjectColor}12`, padding: "3px 9px", borderRadius: 999 }}>
                  {SUBJECT_LABEL[book.subject] ?? book.subject}
                </span>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>課題プリント</span>
                {book.school_name && (
                  <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 999 }}>
                    🏫 {book.school_name}
                  </span>
                )}
              </div>
              <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#0F172A", lineHeight: 1.3 }}>{book.title}</h1>
              {book.description && <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{book.description}</p>}
              {book.due_date && (
                <div style={{ marginTop: 6, fontSize: 12, color: new Date(book.due_date) < new Date() ? "#DC2626" : "#64748B", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={12} />
                  締切: {fmt(book.due_date)}
                </div>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => void addToShelf()}
              disabled={inShelf || addingShelf}
              style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: inShelf ? "#F0FDF4" : subjectColor, color: inShelf ? "#059669" : "#fff", fontSize: 13, fontWeight: 800, cursor: inShelf ? "default" : "pointer" }}
            >
              {inShelf ? "✓ 本棚に追加済み" : addingShelf ? "追加中..." : "本棚に追加"}
            </button>
            {inShelf && (
              <button
                onClick={() => router.push(`/shelf/${book.id}`)}
                style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${subjectColor}`, background: "#fff", color: subjectColor, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                演習を始める <ChevronRight size={14} />
              </button>
            )}
            <button onClick={copyUrl} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {copied ? <><Check size={13} /> コピー済み</> : <><Copy size={13} /> URLを共有</>}
            </button>
          </div>
        </div>

        {/* ─ 概要統計 ─ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "演習した人数", value: `${stats.totalStudents}人`, icon: <Users size={16} color="#3157B7" /> },
            { label: "総問題数", value: `${book.total_problems || "—"}問`, icon: <BookOpen size={16} color="#059669" /> },
            { label: "平均評価", value: avgRating ? `${avgRating.toFixed(1)} / 5` : "未評価", icon: <Star size={16} color="#B45309" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} style={miniCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>{icon}<span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{label}</span></div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ─ よく間違える問題 ─ */}
        {worstProblems.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>
              ⚡ みんなが間違えやすい問題
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {worstProblems.map(([no, s]) => {
                const correctRate = s.total ? Math.round(s.correct / s.total * 100) : 0;
                const label = (book.problem_labels as string[])?.[Number(no) - 1] ?? `問${no}`;
                return (
                  <div key={no} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 48, fontSize: 12, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>{label}</div>
                    <div style={{ flex: 1, height: 16, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${correctRate}%`, height: "100%", background: pctColor(correctRate), borderRadius: 999, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ width: 44, fontSize: 12, fontWeight: 800, color: pctColor(correctRate), textAlign: "right", flexShrink: 0 }}>
                      {correctRate}%
                    </div>
                    <div style={{ fontSize: 11, color: "#CBD5E1", flexShrink: 0 }}>{s.total}人</div>
                  </div>
                );
              })}
            </div>
            {problemEntries.length > 5 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>全問題の正答率</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {problemEntries.map(([no, s]) => {
                    const rate = s.total ? Math.round(s.correct / s.total * 100) : null;
                    const label = (book.problem_labels as string[])?.[Number(no) - 1] ?? `問${no}`;
                    return (
                      <div key={no} style={{ padding: "5px 10px", borderRadius: 8, background: rate != null ? `${pctColor(rate)}15` : "#F8FAFC", border: `1px solid ${rate != null ? pctColor(rate) + "30" : "#E2E8F0"}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: rate != null ? pctColor(rate) : "#CBD5E1" }}>{rate != null ? `${rate}%` : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─ 難易度バー ─ */}
        {avgDifficulty != null && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>みんなの体感難易度</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>易</span>
              <div style={{ flex: 1, height: 12, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${(avgDifficulty / 5) * 100}%`, height: "100%", background: avgDifficulty >= 4 ? "#DC2626" : avgDifficulty >= 3 ? "#B45309" : "#059669", borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>難</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", minWidth: 32 }}>{avgDifficulty.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* ─ レビュー ─ */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
              レビュー {reviews.length > 0 && <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>（{reviews.length}件）</span>}
            </div>
            {!myReview && (
              <button onClick={() => setShowReviewForm(true)} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                レビューを書く
              </button>
            )}
          </div>

          {/* レビューフォーム */}
          {showReviewForm && (
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px", marginBottom: 14, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>評価</span>
                <button onClick={() => setShowReviewForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={14} /></button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setReviewRating(n)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${n <= reviewRating ? "#B45309" : "#E2E8F0"}`, background: n <= reviewRating ? "#FFFBEB" : "#fff", fontSize: 18, cursor: "pointer" }}>
                    {n <= reviewRating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>難易度</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["1", "易"], ["2", "やや易"], ["3", "普通"], ["4", "やや難"], ["5", "難"]].map(([v, label]) => (
                    <button key={v} onClick={() => setReviewDifficulty(Number(v))} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${reviewDifficulty === Number(v) ? "#3157B7" : "#E2E8F0"}`, background: reviewDifficulty === Number(v) ? "#DBEAFE" : "#fff", color: reviewDifficulty === Number(v) ? "#1D4ED8" : "#64748B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="コメント（任意）"
                rows={2}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
              />
              <button onClick={() => void saveReview()} disabled={!reviewRating || savingReview} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: reviewRating ? "#3157B7" : "#E2E8F0", color: reviewRating ? "#fff" : "#94A3B8", fontSize: 13, fontWeight: 800, cursor: reviewRating ? "pointer" : "not-allowed" }}>
                {savingReview ? "保存中..." : "投稿する"}
              </button>
            </div>
          )}

          {reviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#CBD5E1", fontSize: 13 }}>まだレビューがありません</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ padding: "12px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{"⭐".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      {r.difficulty != null && (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>難易度 {r.difficulty}/5</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#CBD5E1" }}>{r.students?.name ?? "匿名"}</span>
                      {myReview?.id === r.id && (
                        <button onClick={() => void deleteReview()} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.comment && <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─ 公開演習記録 ─ */}
        {publicExercises.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>みんなの演習記録</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["日付", "範囲", "問題数", "正解数", "正答率", "所要時間"].map((h, i) => (
                      <th key={i} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 800, color: "#94A3B8", textAlign: i === 1 ? "left" : "center", borderBottom: "1px solid #E2E8F0", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {publicExercises.map((ex, idx) => {
                    const rate = ex.question_count > 0 ? Math.round(ex.correct_count / ex.question_count * 100) : null;
                    return (
                      <tr key={ex.id} style={{ borderBottom: idx < publicExercises.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748B", whiteSpace: "nowrap" }}>{fmt(ex.date)}</td>
                        <td style={{ padding: "10px 12px", color: "#0F172A", fontWeight: 700 }}>{ex.range || "—"}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748B" }}>{ex.question_count}問</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#0F172A", fontWeight: 700 }}>{ex.correct_count}問</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {rate != null ? <span style={{ fontWeight: 800, color: pctColor(rate) }}>{rate}%</span> : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748B" }}>
                          {ex.duration > 0 ? `${ex.duration}分` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
const miniCardStyle: CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const spinnerStyle: CSSProperties = { width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3157B7", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
