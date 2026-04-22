"use client";

import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import { SUBJECT_COLOR, SUBJECT_BG, SUBJECT_LABEL } from "@/lib/types";
import {
  ArrowLeft, Check, AlertTriangle, BookOpen,
  X as XIcon, Timer, SplitSquareHorizontal, Minus, Plus, GraduationCap,
  Square, Play, Pause,
} from "lucide-react";
import { refreshXpBar } from "@/app/components/XpBar";

// ── 型 ────────────────────────────────────────────────────────────
type BookData = {
  id: string; title: string; subject: string; level: number;
  level_label: string; total_problems: number; category: string; publisher: string;
};
type AttemptSlot = {
  result: "perfect" | "unsure" | "checked" | "wrong" | null;
  recorded_at: string | null;
};

// problemData キー: "${problem_no}_${sub_no}_${subsub_no}"
// sub_no=0, subsub_no=0 → 小問・小小問なし（通常問題）
// sub_no≥1, subsub_no=0 → 小問あり、小小問なし
// sub_no≥1, subsub_no≥1 → 小問・小小問あり

// ── 定数 ─────────────────────────────────────────────────────────
const RESULTS = [
  { value: "perfect" as const, Icon: Check,        short: "完全", color: "#059669", bg: "#ECFDF5" },
  { value: "unsure"  as const, Icon: AlertTriangle, short: "不安", color: "#B45309", bg: "#FFFBEB" },
  { value: "checked" as const, Icon: BookOpen,      short: "確認", color: "#1D4ED8", bg: "#EFF6FF" },
  { value: "wrong"   as const, Icon: XIcon,         short: "不可", color: "#DC2626", bg: "#FEF2F2" },
] as const;

// タップサイクル順：未記録 → 完全 → 不安 → 確認 → 不可 → 未記録（消去）
const CYCLE_ORDER = ["perfect", "unsure", "checked", "wrong"] as const;
type ResultVal = typeof CYCLE_ORDER[number];

function nextResult(current: ResultVal | null): ResultVal | null {
  if (!current) return "perfect";
  const idx = CYCLE_ORDER.indexOf(current);
  // 不可（最後）の次は null（消去）
  if (idx === CYCLE_ORDER.length - 1) return null;
  return CYCLE_ORDER[idx + 1];
}

const ATTEMPT_LABELS = ["1回目", "2回目", "3回目"];
const TABLE_COLS = "52px 1fr 1fr 1fr 30px";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
                 "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

function emptySlots(): AttemptSlot[] {
  return [
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
  ];
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── メインコンポーネント ───────────────────────────────────────────
export default function ShelfBookPage() {
  const { bookId } = useParams<{ bookId: string }>();

  const [book, setBook]       = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);

  // DB保存済みのデータ（比較用）
  const [savedData, setSavedData]           = useState<Record<string, AttemptSlot[]>>({});
  // 表示用データ（未保存の変更を含む）
  const [problemData, setProblemData]       = useState<Record<string, AttemptSlot[]>>({});
  // 未保存の変更セット  key: "pno_sno_ssno_attempt_no"
  const [dirtyKeys, setDirtyKeys]           = useState<Set<string>>(new Set());

  // 小問数  key: problem_no
  const [subStructure, setSubStructure]     = useState<Record<number, number>>({});
  // 小小問数 key: "pno_sno"
  const [subsubStructure, setSubsubStructure] = useState<Record<string, number>>({});

  const [openEditor, setOpenEditor]     = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [bulkSaving, setBulkSaving]     = useState(false);

  // ── テスト・模試スコア記録 ────────────────────────────────────
  type ScoreEntry = { id: string; exam_date: string; total_score: number | null; total_max: number | null; total_deviation: number | null; memo: string | null };
  const [examScores, setExamScores]       = useState<ScoreEntry[]>([]);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreDate, setScoreDate]         = useState(new Date().toISOString().slice(0, 10));
  const [scoreTotal, setScoreTotal]       = useState("");
  const [scoreMax, setScoreMax]           = useState("");
  const [scoreDev, setScoreDev]           = useState("");
  const [scoreMemo, setScoreMemo]         = useState("");
  const [scoreSaving, setScoreSaving]     = useState(false);

  // ── タイマー ──────────────────────────────────────────────────
  type TimerState = "idle" | "running" | "paused";
  const [timerState, setTimerState]   = useState<TimerState>("idle");
  const [elapsedMs, setElapsedMs]     = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [sessionRange, setSessionRange]   = useState("");
  const [sessionSaving, setSessionSaving] = useState(false);
  // セッション開始時のスナップショット（変更量を計算するため）
  const sessionSnapshot = useRef<Record<string, AttemptSlot[]>>({});
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number>(0); // performance.now() ベース
  const baseMs   = useRef<number>(0); // 一時停止で積み上げた時間

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  }

  const tickTimer = useCallback(() => {
    setElapsedMs(baseMs.current + (performance.now() - startRef.current));
    rafRef.current = requestAnimationFrame(tickTimer);
  }, []);

  const startTimer = () => {
    sessionSnapshot.current = JSON.parse(JSON.stringify(problemData));
    baseMs.current = 0;
    startRef.current = performance.now();
    setElapsedMs(0);
    setTimerState("running");
    rafRef.current = requestAnimationFrame(tickTimer);
  };

  const pauseTimer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    baseMs.current += performance.now() - startRef.current;
    setTimerState("paused");
  };

  const resumeTimer = () => {
    startRef.current = performance.now();
    setTimerState("running");
    rafRef.current = requestAnimationFrame(tickTimer);
  };

  const stopTimer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerState === "running") baseMs.current += performance.now() - startRef.current;
    setElapsedMs(baseMs.current);
    setTimerState("idle");
    setShowStopModal(true);
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // セッション中の変更を集計
  function calcSessionStats() {
    const snap = sessionSnapshot.current;
    const changed: string[] = [];
    let correct = 0;
    for (const key of Object.keys(problemData)) {
      const before = snap[key] ?? [];
      const after  = problemData[key] ?? [];
      for (let i = 0; i < 3; i++) {
        if (before[i]?.result !== after[i]?.result && after[i]?.result) {
          if (!changed.includes(key)) changed.push(key);
          if (after[i].result === "perfect") correct++;
        }
      }
    }
    return { questionCount: changed.length, correctCount: correct };
  }

  const saveSession = async () => {
    if (!book) return;
    const { questionCount, correctCount } = calcSessionStats();
    setSessionSaving(true);
    await fetch("/api/exercise-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        subject: book.subject,
        material: book.title,
        range: sessionRange,
        question_count: questionCount,
        correct_count: correctCount,
        duration: Math.max(1, Math.round(baseMs.current / 60000)),
        needs_review: correctCount < questionCount * 0.6,
      }),
    });
    setSessionSaving(false);
    setShowStopModal(false);
    setSessionRange("");
    baseMs.current = 0;
  };

  const saveScore = async () => {
    if (!book) return;
    setScoreSaving(true);
    const res = await fetch("/api/mock-exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_name: book.title,
        exam_date: scoreDate,
        scores: {},
        total_score: scoreTotal !== "" ? Number(scoreTotal) : null,
        total_max: scoreMax !== "" ? Number(scoreMax) : null,
        total_deviation: scoreDev !== "" ? Number(scoreDev) : null,
        memo: scoreMemo || null,
        book_id: bookId,
      }),
    });
    const data = await res.json();
    if (data.exam) setExamScores(prev => [data.exam, ...prev]);
    setScoreSaving(false);
    setShowScoreForm(false);
    setScoreTotal(""); setScoreMax(""); setScoreDev(""); setScoreMemo("");
    setScoreDate(new Date().toISOString().slice(0, 10));
  };

  const deleteScore = async (id: string) => {
    await fetch(`/api/mock-exams/${id}`, { method: "DELETE" });
    setExamScores(prev => prev.filter(e => e.id !== id));
  };

  // ── データ読み込み ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!bookId) return;
    const [bookRes, resultsRes, scoresRes] = await Promise.all([
      fetch(`/api/shelf/book?book_id=${bookId}`),
      fetch(`/api/problem-results?book_id=${bookId}`),
      fetch(`/api/mock-exams?book_id=${bookId}`),
    ]);
    const bookData    = await bookRes.json();
    const resultsData = await resultsRes.json();
    const scoresData  = scoresRes.ok ? await scoresRes.json() : { exams: [] };
    const b: BookData = bookData.book;
    setBook(b);
    setExamScores(scoresData.exams ?? []);

    const sub:    Record<number, number> = resultsData.subStructure    ?? {};
    const subsub: Record<string, number> = resultsData.subsubStructure ?? {};
    setSubStructure(sub);
    setSubsubStructure(subsub);

    // スロット初期化
    const grouped: Record<string, AttemptSlot[]> = {};
    for (let pno = 1; pno <= b.total_problems; pno++) {
      const subCount = sub[pno] ?? 0;
      if (subCount === 0) {
        grouped[`${pno}_0_0`] = emptySlots();
      } else {
        for (let sno = 1; sno <= subCount; sno++) {
          const ssCount = subsub[`${pno}_${sno}`] ?? 0;
          if (ssCount === 0) {
            grouped[`${pno}_${sno}_0`] = emptySlots();
          } else {
            for (let ssno = 1; ssno <= ssCount; ssno++) {
              grouped[`${pno}_${sno}_${ssno}`] = emptySlots();
            }
          }
        }
      }
    }

    // 記録を流し込む
    for (const r of resultsData.results ?? []) {
      const sno  = r.sub_no    ?? 0;
      const ssno = r.subsub_no ?? 0;
      const key  = `${r.problem_no}_${sno}_${ssno}`;
      const idx  = (r.attempt_no ?? 1) - 1;
      if (!grouped[key]) grouped[key] = emptySlots();
      if (idx >= 0 && idx < 3) {
        grouped[key][idx] = { result: r.result, recorded_at: r.recorded_at };
      }
    }
    setSavedData(JSON.parse(JSON.stringify(grouped))); // deep copy
    setProblemData(grouped);
    setDirtyKeys(new Set());
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── タップ：ローカル表示のみ変更（保存はしない） ──────────────
  const handleRecord = (
    pno: number, sno: number, ssno: number,
    attempt_no: number, result: ResultVal | null,
  ) => {
    const key     = `${pno}_${sno}_${ssno}`;
    const dirtyKey = `${key}_${attempt_no}`;

    // 同じ結果なら何もしない
    const currentResult = (problemData[key] ?? emptySlots())[attempt_no - 1].result;
    if (currentResult === result) return;

    // 表示を更新
    setProblemData(prev => {
      const slots = prev[key] ? [...prev[key]] : emptySlots();
      slots[attempt_no - 1] = { result, recorded_at: result ? new Date().toISOString() : null };
      return { ...prev, [key]: slots };
    });

    // DB保存済みと同じ値に戻したら dirty から外す
    const savedResult = (savedData[key] ?? emptySlots())[attempt_no - 1].result;
    setDirtyKeys(prev => {
      const next = new Set(prev);
      if (result === savedResult) next.delete(dirtyKey);
      else next.add(dirtyKey);
      return next;
    });
  };

  // ── 一括保存 ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (dirtyKeys.size === 0 || bulkSaving) return;
    setBulkSaving(true);

    let newPerfects = 0;
    const now = new Date().toISOString();

    await Promise.all(Array.from(dirtyKeys).map(async dirtyKey => {
      // dirtyKey = "pno_sno_ssno_attempt_no"
      const parts = dirtyKey.split("_");
      const attempt_no = parseInt(parts[3]);
      const slotKey    = parts.slice(0, 3).join("_");
      const [pno, sno, ssno] = parts.slice(0, 3).map(Number);

      const result = (problemData[slotKey] ?? emptySlots())[attempt_no - 1].result as ResultVal | null;
      const savedResult = (savedData[slotKey] ?? emptySlots())[attempt_no - 1].result;

      if (result === null) {
        await fetch(
          `/api/problem-results?book_id=${bookId}&problem_no=${pno}&sub_no=${sno}&subsub_no=${ssno}&attempt_no=${attempt_no}`,
          { method: "DELETE" },
        );
      } else {
        // 新規 or 結果が変わった場合にperfect加算
        if (result === "perfect" && savedResult !== "perfect") newPerfects++;
        await fetch("/api/problem-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book_id: bookId, problem_no: pno, sub_no: sno, subsub_no: ssno, attempt_no, result, recorded_at: now }),
        });
      }
    }));

    // XPは保存時に1回だけ
    if (dirtyKeys.size > 0) {
      const action = newPerfects > 0 ? "record_perfect" : "record_any";
      fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).then(() => refreshXpBar());
    }

    // savedData を現在の problemData で更新
    setSavedData(JSON.parse(JSON.stringify(problemData)));
    setDirtyKeys(new Set());
    setBulkSaving(false);
  };

  // ── 小問数の変更（即時保存） ──────────────────────────────────
  const handleSubCount = async (pno: number, newCount: number) => {
    setEditorSaving(true);
    await fetch("/api/problem-sub-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, problem_no: pno, sub_count: newCount }),
    });

    setSubStructure(prev => {
      if (newCount === 0) { const n = { ...prev }; delete n[pno]; return n; }
      return { ...prev, [pno]: newCount };
    });
    // 小問が増減したらスロットを再構築
    setProblemData(prev => {
      const next = { ...prev };
      // 旧スロット削除
      Object.keys(next).filter(k => k.startsWith(`${pno}_`)).forEach(k => delete next[k]);
      if (newCount === 0) {
        next[`${pno}_0_0`] = emptySlots();
      } else {
        for (let sno = 1; sno <= newCount; sno++) {
          const ssCount = subsubStructure[`${pno}_${sno}`] ?? 0;
          if (ssCount === 0) {
            next[`${pno}_${sno}_0`] = emptySlots();
          } else {
            for (let ssno = 1; ssno <= ssCount; ssno++) {
              next[`${pno}_${sno}_${ssno}`] = emptySlots();
            }
          }
        }
      }
      return next;
    });
    setEditorSaving(false);
  };

  // ── 小小問数の変更（即時保存） ────────────────────────────────
  const handleSubsubCount = async (pno: number, sno: number, newCount: number) => {
    setEditorSaving(true);
    await fetch("/api/problem-subsub-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, problem_no: pno, sub_no: sno, subsub_count: newCount }),
    });

    const ssKey = `${pno}_${sno}`;
    setSubsubStructure(prev => {
      if (newCount === 0) { const n = { ...prev }; delete n[ssKey]; return n; }
      return { ...prev, [ssKey]: newCount };
    });
    setProblemData(prev => {
      const next = { ...prev };
      Object.keys(next).filter(k => k.startsWith(`${pno}_${sno}_`)).forEach(k => delete next[k]);
      if (newCount === 0) {
        next[`${pno}_${sno}_0`] = emptySlots();
      } else {
        for (let ssno = 1; ssno <= newCount; ssno++) {
          next[`${pno}_${sno}_${ssno}`] = emptySlots();
        }
      }
      return next;
    });
    setEditorSaving(false);
  };

  // ── 統計 ─────────────────────────────────────────────────────
  const total      = book?.total_problems ?? 0;
  const problemNos = Array.from({ length: total }, (_, i) => i + 1);

  const allKeys = problemNos.flatMap(pno => {
    const subCount = subStructure[pno] ?? 0;
    if (subCount === 0) return [`${pno}_0_0`];
    return Array.from({ length: subCount }, (_, si) => {
      const sno = si + 1;
      const ssCount = subsubStructure[`${pno}_${sno}`] ?? 0;
      if (ssCount === 0) return [`${pno}_${sno}_0`];
      return Array.from({ length: ssCount }, (_, ssi) => `${pno}_${sno}_${ssi + 1}`);
    }).flat();
  });

  const latestResults = allKeys.map(key => {
    const slots = problemData[key] ?? [];
    for (let i = 2; i >= 0; i--) if (slots[i]?.result) return slots[i].result;
    return null;
  });

  const totalCount = allKeys.length;
  const stats = {
    perfect:   latestResults.filter(r => r === "perfect").length,
    unsure:    latestResults.filter(r => r === "unsure").length,
    checked:   latestResults.filter(r => r === "checked").length,
    wrong:     latestResults.filter(r => r === "wrong").length,
    attempted: latestResults.filter(r => r !== null).length,
  };
  const mastery  = totalCount > 0 ? Math.round((stats.perfect  / totalCount) * 100) : 0;
  const coverage = totalCount > 0 ? Math.round((stats.attempted / totalCount) * 100) : 0;

  const color = SUBJECT_COLOR[book?.subject ?? ""] ?? "#6B7280";
  const bg    = SUBJECT_BG[book?.subject ?? ""]   ?? "#F9FAFB";

  if (loading) return (
    <AppLayout>
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={spinnerStyle} />
      </div>
    </AppLayout>
  );
  if (!book) return (
    <AppLayout>
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>本が見つかりません</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ minHeight: "100dvh", background: "#EEF1F8" }}>

        {/* ── ヘッダー ── */}
        <header style={{
          height: 56, background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
          position: "sticky", top: "var(--xp-bar-h)", zIndex: 10,
        }}>
          <Link href="/shelf" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            background: "var(--bg-elevated)", color: "var(--text-muted)", textDecoration: "none",
          }}>
            <ArrowLeft size={16} strokeWidth={2.2} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {book.title}
            </p>
          </div>
          {/* タイマーコントロール */}
          {timerState === "idle" ? (
            <button onClick={startTimer} style={timerStartBtnStyle}>
              <Play size={12} strokeWidth={2.5} /> 演習を開始
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 900, fontFamily: "monospace", color: timerState === "running" ? "#2563EB" : "#64748B", letterSpacing: -0.5, minWidth: 52 }}>
                {formatMs(elapsedMs)}
              </span>
              {timerState === "running"
                ? <button onClick={pauseTimer} style={timerMiniBtn}><Pause size={11} /></button>
                : <button onClick={resumeTimer} style={timerMiniBtn}><Play size={11} /></button>
              }
              <button onClick={stopTimer} style={{ ...timerMiniBtn, color: "#EF4444", borderColor: "#FECACA", background: "#FFF5F5" }}>
                <Square size={11} />
              </button>
            </div>
          )}
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 80px" }}>

          {/* ── 統計カード ── */}
          <div style={{
            background: "#fff", border: "1px solid #E4E7EC",
            borderRadius: 14, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: bg, color }}>
                  {SUBJECT_LABEL[book.subject] ?? book.subject}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#EEF1F8", color: "var(--accent)" }}>
                  Lv.{book.level}
                </span>
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                  全{total}問
                  {totalCount !== total && <span style={{ color: "#3B52B4", marginLeft: 4 }}>（展開後 {totalCount}）</span>}
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#1D2939", lineHeight: 1.3 }}>
                {book.title}
              </p>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>マスター率</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: mastery >= 80 ? "#059669" : "#3B52B4" }}>{mastery}%</span>
                </div>
                <div style={{ height: 8, background: "#EEF1F8", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${mastery}%`,
                    background: mastery >= 80 ? "linear-gradient(90deg,#059669,#10B981)" : `linear-gradient(90deg,${color},${color}99)`,
                    borderRadius: 99, transition: "width 0.5s",
                  }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>演習カバー率</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#667085" }}>{stats.attempted}/{totalCount}</span>
                </div>
                <div style={{ height: 6, background: "#EEF1F8", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${coverage}%`,
                    background: "linear-gradient(90deg,#C9CDD6,#8DA2C8)",
                    borderRadius: 99, transition: "width 0.5s",
                  }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {RESULTS.map(({ value, Icon, short, color: c }) => (
                  <div key={value} style={{
                    background: "#F8F9FC", borderRadius: 10, padding: "8px 6px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  }}>
                    <Icon size={13} strokeWidth={2.2} color={c} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1D2939", lineHeight: 1 }}>{stats[value]}</span>
                    <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600 }}>{short}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── テスト・模試スコアパネル ── */}
          {book.category === "テスト・模試" && (
            <div style={{ background: "#fff", border: "1px solid #E4E7EC", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: examScores.length > 0 || showScoreForm ? "1px solid #F1F5F9" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>成績記録</div>
                <button onClick={() => setShowScoreForm(v => !v)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: showScoreForm ? "#F1F5F9" : "#fff", color: "#3157B7", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {showScoreForm ? "キャンセル" : "+ 記録を追加"}
                </button>
              </div>

              {showScoreForm && (
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", background: "#FAFBFF" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <label style={scoreFormLabelStyle}>
                      <span>受験日</span>
                      <input type="date" value={scoreDate} onChange={e => setScoreDate(e.target.value)} style={scoreFormInputStyle} />
                    </label>
                    <label style={scoreFormLabelStyle}>
                      <span>偏差値（任意）</span>
                      <input type="number" step="0.1" value={scoreDev} onChange={e => setScoreDev(e.target.value)} placeholder="62.5" style={scoreFormInputStyle} />
                    </label>
                    <label style={scoreFormLabelStyle}>
                      <span>得点</span>
                      <input type="number" value={scoreTotal} onChange={e => setScoreTotal(e.target.value)} placeholder="170" style={scoreFormInputStyle} />
                    </label>
                    <label style={scoreFormLabelStyle}>
                      <span>満点</span>
                      <input type="number" value={scoreMax} onChange={e => setScoreMax(e.target.value)} placeholder="200" style={scoreFormInputStyle} />
                    </label>
                    <label style={{ ...scoreFormLabelStyle, gridColumn: "1 / -1" }}>
                      <span>メモ（任意）</span>
                      <input value={scoreMemo} onChange={e => setScoreMemo(e.target.value)} placeholder="気づいた点など" style={scoreFormInputStyle} />
                    </label>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => void saveScore()} disabled={scoreSaving} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#3157B7,#5B73D4)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      {scoreSaving ? "保存中..." : "保存する"}
                    </button>
                  </div>
                </div>
              )}

              {examScores.length > 0 && (
                <div>
                  {examScores.map((e, i) => {
                    const pct = e.total_score != null && e.total_max != null ? Math.round(e.total_score / e.total_max * 100) : null;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < examScores.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, minWidth: 72 }}>{e.exam_date}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                          {e.total_score != null && e.total_max != null ? `${e.total_score} / ${e.total_max}` : "—"}
                          {pct != null && <span style={{ fontSize: 11, color: "#64748B", marginLeft: 6 }}>({pct}%)</span>}
                        </div>
                        {e.total_deviation != null && (
                          <div style={{ fontSize: 15, fontWeight: 900, color: Number(e.total_deviation) >= 65 ? "#059669" : Number(e.total_deviation) >= 55 ? "#3157B7" : "#B45309" }}>
                            {Number(e.total_deviation).toFixed(1)}
                          </div>
                        )}
                        {e.memo && <div style={{ fontSize: 11, color: "#94A3B8", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.memo}</div>}
                        <button onClick={() => void deleteScore(e.id)} style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {examScores.length === 0 && !showScoreForm && (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>まだ成績が記録されていません</div>
              )}
            </div>
          )}

          {/* ── 記録テーブル ── */}
          <div style={{
            background: "#fff", border: "1px solid #E4E7EC",
            borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            {/* テーブルヘッダー */}
            <div style={{
              display: "grid", gridTemplateColumns: TABLE_COLS,
              background: "#F8F9FC", borderBottom: "2px solid #E4E7EC",
              borderRadius: "14px 14px 0 0",
            }}>
              <div style={thStyle}>#</div>
              {ATTEMPT_LABELS.map(l => <div key={l} style={thStyle}>{l}</div>)}
              <div style={{ ...thStyle, border: "none" }} />
            </div>

            {problemNos.map((pno, pIdx) => {
              const subCount = subStructure[pno] ?? 0;
              const isLastProblem = pIdx === problemNos.length - 1;
              const editorKey = `main_${pno}`;
              const isEditorOpen = openEditor === editorKey;

              return (
                <div key={pno}>

                  {/* ── 小問なし（通常1行） ── */}
                  {subCount === 0 && (
                    <>
                      <ProblemRow
                        label={String(pno)}
                        labelColor="#3B52B4"
                        labelSize={12}
                        slotKey={`${pno}_0_0`}
                        pno={pno} sno={0} ssno={0}
                        problemData={problemData}
                        dirtyKeys={dirtyKeys}
                        onRecord={handleRecord}
                        isLast={isLastProblem && !isEditorOpen}
                        bgIndex={pIdx}
                        bookTitle={book.title}
                        bookId={bookId}
                        splitIcon={
                          <SplitBtn
                            active={isEditorOpen}
                            onClick={() => setOpenEditor(isEditorOpen ? null : editorKey)}
                          />
                        }
                      />
                      {isEditorOpen && (
                        <CountEditorRow
                          label="小問数"
                          current={0}
                          saving={editorSaving}
                          isLast={isLastProblem}
                          onClose={() => setOpenEditor(null)}
                          onChange={n => handleSubCount(pno, n)}
                        />
                      )}
                    </>
                  )}

                  {/* ── 小問あり ── */}
                  {subCount > 0 && (
                    <>
                      {/* 大問ヘッダー行 */}
                      <div style={{
                        display: "grid", gridTemplateColumns: TABLE_COLS,
                        background: "#F5F7FF", borderBottom: "1px solid #E8EAFF",
                      }}>
                        <div style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          padding: "5px 2px", gap: 2, borderRight: "1px solid #E8EAFF",
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#3B52B4" }}>{pno}</span>
                          <SplitBtn
                            active={isEditorOpen}
                            onClick={() => setOpenEditor(isEditorOpen ? null : editorKey)}
                          />
                        </div>
                        <div style={{
                          gridColumn: "2 / 6", display: "flex", alignItems: "center",
                          paddingLeft: 10, fontSize: 11, fontWeight: 600, color: "#6B7280", gap: 6,
                        }}>
                          大問 {pno}
                          <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400 }}>（小問 {subCount}問）</span>
                        </div>
                      </div>

                      {/* 小問数エディタ（大問直下） */}
                      {isEditorOpen && (
                        <CountEditorRow
                          label="小問数"
                          current={subCount}
                          saving={editorSaving}
                          isLast={false}
                          onClose={() => setOpenEditor(null)}
                          onChange={n => handleSubCount(pno, n)}
                        />
                      )}

                      {/* 各小問 */}
                      {Array.from({ length: subCount }, (_, si) => {
                        const sno = si + 1;
                        const ssCount   = subsubStructure[`${pno}_${sno}`] ?? 0;
                        const subEditorKey  = `sub_${pno}_${sno}`;
                        const isSubEditorOpen = openEditor === subEditorKey;
                        const isLastSub = si === subCount - 1 && isLastProblem;

                        return (
                          <div key={sno}>
                            {/* ── 小小問なし（小問1行） ── */}
                            {ssCount === 0 && (
                              <>
                                <ProblemRow
                                  label={`(${sno})`}
                                  labelColor="#6B7280"
                                  labelSize={11}
                                  slotKey={`${pno}_${sno}_0`}
                                  pno={pno} sno={sno} ssno={0}
                                  problemData={problemData}
                                  dirtyKeys={dirtyKeys}
                                  onRecord={handleRecord}
                                  isLast={isLastSub && !isSubEditorOpen}
                                  bgIndex={si}
                                  indent
                                  bookTitle={book.title}
                        bookId={bookId}
                                  splitIcon={
                                    <SplitBtn
                                      active={isSubEditorOpen}
                                      onClick={() => setOpenEditor(isSubEditorOpen ? null : subEditorKey)}
                                    />
                                  }
                                />
                                {isSubEditorOpen && (
                                  <CountEditorRow
                                    label="丸数字数"
                                    current={0}
                                    saving={editorSaving}
                                    isLast={isLastSub}
                                    onClose={() => setOpenEditor(null)}
                                    onChange={n => handleSubsubCount(pno, sno, n)}
                                    indent
                                  />
                                )}
                              </>
                            )}

                            {/* ── 小小問あり ── */}
                            {ssCount > 0 && (
                              <>
                                {/* 小問ヘッダー行 */}
                                <div style={{
                                  display: "grid", gridTemplateColumns: TABLE_COLS,
                                  background: "#FAFBFF", borderBottom: "1px solid #F0F1FA",
                                }}>
                                  <div style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", justifyContent: "center",
                                    padding: "4px 2px", gap: 1, borderRight: "1px solid #F0F1FA",
                                    paddingLeft: 6,
                                  }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#6B7280" }}>{`(${sno})`}</span>
                                    <SplitBtn
                                      active={isSubEditorOpen}
                                      onClick={() => setOpenEditor(isSubEditorOpen ? null : subEditorKey)}
                                      size={10}
                                    />
                                  </div>
                                  <div style={{
                                    gridColumn: "2 / 6", display: "flex", alignItems: "center",
                                    paddingLeft: 10, fontSize: 10, fontWeight: 600, color: "#9CA3AF", gap: 4,
                                  }}>
                                    ({sno})
                                    <span style={{ fontSize: 10, color: "#C0C4D0", fontWeight: 400 }}>（{CIRCLED[0]}〜{CIRCLED[ssCount - 1]}）</span>
                                  </div>
                                </div>

                                {/* 小問数エディタ */}
                                {isSubEditorOpen && (
                                  <CountEditorRow
                                    label="丸数字数"
                                    current={ssCount}
                                    saving={editorSaving}
                                    isLast={false}
                                    onClose={() => setOpenEditor(null)}
                                    onChange={n => handleSubsubCount(pno, sno, n)}
                                    indent
                                  />
                                )}

                                {/* 各小小問 */}
                                {Array.from({ length: ssCount }, (_, ssi) => {
                                  const ssno = ssi + 1;
                                  const isLastSubsub = ssi === ssCount - 1 && isLastSub;
                                  return (
                                    <ProblemRow
                                      key={ssno}
                                      label={CIRCLED[ssi]}
                                      labelColor="#9CA3AF"
                                      labelSize={12}
                                      slotKey={`${pno}_${sno}_${ssno}`}
                                      pno={pno} sno={sno} ssno={ssno}
                                      problemData={problemData}
                                      dirtyKeys={dirtyKeys}
                                      onRecord={handleRecord}
                                      isLast={isLastSubsub}
                                      bgIndex={ssi}
                                      indent2
                                      bookTitle={book.title}
                        bookId={bookId}
                                    />
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* ── 保存バー（変更があるときだけ表示） ── */}
        {dirtyKeys.size > 0 && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            padding: "12px 16px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid #E4E7EC",
            display: "flex", alignItems: "center", gap: 10,
            zIndex: 50,
          }}>
            <span style={{ flex: 1, fontSize: 13, color: "#667085", fontWeight: 500 }}>
              {dirtyKeys.size}件の変更あり
            </span>
            <button
              onClick={() => {
                // 変更を破棄してsavedDataに戻す
                setProblemData(JSON.parse(JSON.stringify(savedData)));
                setDirtyKeys(new Set());
              }}
              style={{
                padding: "9px 16px", borderRadius: 8,
                border: "1px solid #E4E7EC", background: "#fff",
                fontSize: 13, fontWeight: 600, color: "#6B7280", cursor: "pointer",
              }}
            >
              元に戻す
            </button>
            <button
              onClick={handleSave}
              disabled={bulkSaving}
              style={{
                padding: "9px 20px", borderRadius: 8,
                border: "none",
                background: bulkSaving ? "#93A5D4" : "linear-gradient(135deg, #3B52B4, #5B73D4)",
                fontSize: 13, fontWeight: 700, color: "#fff",
                cursor: bulkSaving ? "not-allowed" : "pointer",
              }}
            >
              {bulkSaving ? "保存中…" : "保存する"}
            </button>
          </div>
        )}
      </div>

      {/* ── 演習終了モーダル ── */}
      {showStopModal && (() => {
        const { questionCount, correctCount } = calcSessionStats();
        return (
          <div style={modalOverlayStyle} onClick={e => { if (e.target === e.currentTarget) { setShowStopModal(false); } }}>
            <div style={modalBoxStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {formatMs(baseMs.current)} の演習
                  </p>
                  <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, color: "#0F172A" }}>お疲れさまでした！</h2>
                </div>
                <button onClick={() => setShowStopModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                  <XIcon size={14} />
                </button>
              </div>

              {/* サマリー */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "時間", value: formatMs(baseMs.current) },
                  { label: "取り組んだ問題", value: `${questionCount}問` },
                  { label: "正解", value: questionCount > 0 ? `${Math.round(correctCount / questionCount * 100)}%` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* 教材（読み取り専用） */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 4 }}>教材</div>
                <div style={{ padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#475569", background: "#F8FAFC" }}>
                  {book?.title}
                </div>
              </div>

              {/* 範囲（任意） */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 4 }}>範囲（任意）</div>
                <input
                  value={sessionRange}
                  onChange={e => setSessionRange(e.target.value)}
                  placeholder="例: p.120–130 / 第3章"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowStopModal(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  破棄
                </button>
                <button onClick={() => void saveSession()} disabled={sessionSaving} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  {sessionSaving ? "保存中..." : "記録を保存"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AppLayout>
  );
}

// ── 分割ボタン ────────────────────────────────────────────────────
function SplitBtn({ active, onClick, size = 11 }: { active: boolean; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      title={active ? "閉じる" : "小問を追加・編集"}
      style={{
        border: `1px solid ${active ? "#A5B4FC" : "#D1D5DB"}`,
        padding: "2px 3px", borderRadius: 4,
        background: active ? "#EEF2FF" : "#F8FAFC",
        cursor: "pointer", lineHeight: 1,
        display: "flex", alignItems: "center",
        color: active ? "#3B52B4" : "#9CA3AF",
      }}
    >
      <SplitSquareHorizontal size={size} strokeWidth={2} />
    </button>
  );
}

// ── 数カウントエディタ行（即時保存、confirmなし） ─────────────────
function CountEditorRow({
  label, current, saving, isLast, onClose, onChange, indent,
}: {
  label: string; current: number; saving: boolean; isLast: boolean;
  onClose: () => void; onChange: (n: number) => void; indent?: boolean;
}) {
  const [inputVal, setInputVal] = useState(String(current === 0 ? "" : current));

  const commit = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n >= 0 && n <= 20) {
      onChange(n);
    } else {
      setInputVal(current === 0 ? "" : String(current));
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      paddingLeft: indent ? 24 : 12,
      background: "#EEF2FF",
      borderBottom: isLast ? "none" : "1px solid #E0E7FF",
      borderLeft: "3px solid #3B52B4",
      flexWrap: "wrap",
    }}>
      <SplitSquareHorizontal size={12} strokeWidth={2} color="#3B52B4" />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#3B52B4", whiteSpace: "nowrap" }}>{label}</span>

      {/* − ボタン */}
      <button
        onClick={() => {
          if (current > 0) {
            const next = current - 1;
            setInputVal(next === 0 ? "" : String(next));
            onChange(next);
          }
        }}
        disabled={saving || current === 0}
        style={countBtnStyle(saving || current === 0)}
      >
        <Minus size={11} strokeWidth={2.5} />
      </button>

      {/* 直接入力 */}
      <input
        type="number"
        min={0}
        max={20}
        value={inputVal}
        placeholder="0"
        disabled={saving}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); }}
        style={{
          width: 52, height: 28, borderRadius: 6,
          border: "1.5px solid #C7D2FE",
          background: saving ? "#F3F4F6" : "#fff",
          fontSize: 14, fontWeight: 800, color: "#1D2939",
          textAlign: "center", outline: "none", padding: "0 4px",
        }}
      />

      {/* + ボタン */}
      <button
        onClick={() => {
          if (current < 20) {
            const next = current + 1;
            setInputVal(String(next));
            onChange(next);
          }
        }}
        disabled={saving || current >= 20}
        style={countBtnStyle(saving || current >= 20)}
      >
        <Plus size={11} strokeWidth={2.5} />
      </button>

      {current > 0 && !saving && (
        <span style={{ fontSize: 11, color: "#6B7280" }}>
          {label === "小問数" ? `(1)〜(${current})` : `${CIRCLED[0]}〜${CIRCLED[current - 1]}`}
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={commit}
          disabled={saving}
          style={{
            height: 28, padding: "0 12px", borderRadius: 6,
            border: "none",
            background: saving ? "#E0E7FF" : "#3B52B4",
            color: "#fff", fontSize: 11, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? "…" : "保存"}
        </button>
        <button onClick={onClose} style={{
          border: "none", background: "transparent",
          cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center",
          padding: 4, borderRadius: 4,
        }}>
          <XIcon size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── 問題行（1行＝3回分のセル） ────────────────────────────────────
function ProblemRow({
  label, labelColor, labelSize, slotKey, pno, sno, ssno,
  problemData, dirtyKeys, onRecord, isLast, bgIndex, indent, indent2, splitIcon,
  bookTitle, bookId,
}: {
  label: string; labelColor: string; labelSize: number;
  slotKey: string; pno: number; sno: number; ssno: number;
  problemData: Record<string, AttemptSlot[]>;
  dirtyKeys: Set<string>;
  onRecord: (p: number, s: number, ss: number, a: number, r: ResultVal | null) => void;
  isLast: boolean; bgIndex: number; indent?: boolean; indent2?: boolean;
  splitIcon?: React.ReactNode;
  bookTitle?: string;
  bookId?: string;
}) {
  const bg = bgIndex % 2 === 0 ? "#fff" : "#FAFBFC";
  const slots = problemData[slotKey] ?? emptySlots();
  const latestResult = [...slots].reverse().find(s => s.result)?.result ?? null;
  const needsHelp = latestResult === "wrong" || latestResult === "unsure";

  const handleAsk = () => {
    let pLabel = `第${pno}問`;
    if (sno > 0) pLabel += ` (${sno})`;
    if (ssno > 0) pLabel += ` ${CIRCLED[ssno - 1]}`;
    const title = bookTitle ? `「${bookTitle}」の` : "";
    const query = `${title}${pLabel}が解けませんでした。解き方を教えてください。`;
    window.location.href = `/my-sensei?query=${encodeURIComponent(query)}`;
  };

  return (
    <div style={{
      borderBottom: isLast && !needsHelp ? "none" : "1px solid #F2F4F7",
    }}>
      {/* メイン行 */}
      <div style={{
        display: "grid", gridTemplateColumns: TABLE_COLS,
        background: bg,
      }}>
      {/* 番号セル */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "6px 2px", gap: 2,
        paddingLeft: indent2 ? 12 : indent ? 8 : 4,
        borderRight: "1px solid #F2F4F7",
      }}>
        <span style={{ fontSize: labelSize, fontWeight: 800, color: labelColor }}>{label}</span>
        {splitIcon}
      </div>

      {/* 3回分セル（タップでサイクル） */}
      {[0, 1, 2].map(ai => {
        const attempt_no = ai + 1;
        const cellKey    = `${pno}_${sno}_${ssno}_${attempt_no}`;
        const isDirty    = dirtyKeys.has(cellKey);
        const slot       = (problemData[slotKey] ?? emptySlots())[ai];
        const result     = slot.result as ResultVal | null;
        const meta       = result ? RESULTS.find(r => r.value === result) : null;

        return (
          <div key={ai} style={{
            borderRight: ai < 2 ? "1px solid #F2F4F7" : "none",
            padding: "4px 4px",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 2, minWidth: 0,
            position: "relative",
          }}>
            {/* 未保存インジケーター */}
            {isDirty && (
              <div style={{
                position: "absolute", top: 5, right: 5,
                width: 5, height: 5, borderRadius: "50%",
                background: "#F59E0B", zIndex: 1,
              }} />
            )}
            <button
              onClick={() => onRecord(pno, sno, ssno, attempt_no, nextResult(result))}
              title={result ? `${meta?.short} → タップで次へ` : "タップして記録"}
              style={{
                width: "100%", padding: "6px 4px",
                border: isDirty ? `1.5px solid #FCD34D` : result ? "none" : "1.5px dashed #D1D5DB",
                borderRadius: 8,
                background: result ? meta!.bg : "transparent",
                cursor: "pointer",
                display: "flex", flexDirection: "row",
                alignItems: "center", justifyContent: "center", gap: 4,
                transition: "background 0.15s",
              }}
            >
              {result && meta ? (
                <>
                  <meta.Icon size={12} strokeWidth={2.5} color={meta.color} />
                  <span style={{ fontSize: 9, fontWeight: 800, color: meta.color, lineHeight: 1 }}>
                    {meta.short}
                  </span>
                  <span style={{ fontSize: 9, color: meta.color, opacity: 0.65, lineHeight: 1, fontWeight: 500 }}>
                    {formatDate(slot.recorded_at)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1 }}>—</span>
              )}
            </button>
          </div>
        );
      })}
      {/* 詳細リンク列 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #F2F4F7" }}>
        {bookId ? (
          <Link
            href={`/shelf/${bookId}/problem/${pno}-${sno}-${ssno}`}
            style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textDecoration: "none", padding: "3px 4px", borderRadius: 4, border: "1px solid #E8ECF0", background: "#F8FAFC", lineHeight: 1, whiteSpace: "nowrap" }}
            title="メモ・写真を見る"
          >
            詳細
          </Link>
        ) : null}
      </div>
      </div>{/* /メイン行 */}

      {/* AIに聞くバー（wrong / unsure のとき表示） */}
      {needsHelp && (
        <button
          onClick={handleAsk}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px",
            background: "#EEF1F8",
            borderTop: "1px solid #D8DFFE",
            borderBottom: isLast ? "none" : undefined,
            cursor: "pointer", textAlign: "left",
            border: "none",
            borderTopStyle: "solid",
            borderTopWidth: 1,
            borderTopColor: "#D8DFFE",
          }}
        >
          <GraduationCap size={12} color="#3B52B4" strokeWidth={2.2} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3B52B4" }}>
            AIに聞く
          </span>
          <span style={{ fontSize: 11, color: "#6B7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            — {(() => {
              let pLabel = `第${pno}問`;
              if (sno > 0) pLabel += ` (${sno})`;
              if (ssno > 0) pLabel += ` ${CIRCLED[ssno - 1]}`;
              return pLabel;
            })()} の解き方を教えてもらう
          </span>
        </button>
      )}
    </div>
  );
}

// ── スタイル ─────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: 2, padding: "8px 2px", fontSize: 9, fontWeight: 700, color: "#9CA3AF",
};

const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: "3px solid var(--border)", borderTop: "3px solid var(--accent)",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};

const scoreFormLabelStyle: CSSProperties = { display: "grid", gap: 3, fontSize: 11, fontWeight: 700, color: "#64748B" };
const scoreFormInputStyle: CSSProperties = { width: "100%", padding: "7px 9px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0F172A", outline: "none", background: "#fff", boxSizing: "border-box" };

const timerStartBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 5, padding: "7px 13px",
  borderRadius: 9, border: "none",
  background: "linear-gradient(135deg, var(--accent), #5B73D4)",
  color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0,
};
const timerMiniBtn: CSSProperties = {
  width: 26, height: 26, borderRadius: 7,
  border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", padding: 0, flexShrink: 0,
};
const modalOverlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
  backdropFilter: "blur(3px)", zIndex: 300,
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const modalBoxStyle: CSSProperties = {
  width: "100%", maxWidth: 520, background: "#fff",
  borderRadius: "20px 20px 0 0", padding: "24px 20px 32px",
  maxHeight: "90dvh", overflowY: "auto",
  boxShadow: "0 -8px 40px rgba(15,23,42,0.18)",
};

function countBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, borderRadius: 6,
    border: "1px solid #C7D2FE",
    background: disabled ? "#F3F4F6" : "#fff",
    color: disabled ? "#D1D5DB" : "#3B52B4",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    flexShrink: 0,
  };
}
