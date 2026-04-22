"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUBJECT_LABEL as SUBJECT_LABEL_LIB } from "@/lib/types";
import AppLayout from "@/app/components/AppLayout";
import {
  AlignLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  GraduationCap,
  ImagePlus,
  Pause,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

type RouteBook = { routeId: string; book: { id: string; title: string; subject: string } };
type BookData = { id: string; title: string; subject: string; level: number; total_problems: number };
type AttemptSlot = { result: ResultVal | null; recorded_at: string | null };
type Phase = "idle" | "loading" | "running" | "paused" | "done";
type PracticeMode = "book" | "free" | "time" | "exam";
type ResultVal = "perfect" | "unsure" | "checked" | "wrong";

type Entry = {
  id: string;
  materialId: string;
  problemNo: number;
  subNo: number;
  subsubNo: number;
  materialTitle: string;
  subject: string;
  memo: string;
  imageUrl: string | null;
  attempts: AttemptSlot[];
  originalKey: string | null;
};

type SubGroup = {
  subNo: number;
  baseEntry: Entry | null;
  subsubs: Entry[];
};

type ProblemGroup = {
  problemNo: number;
  materialTitle: string;
  baseEntry: Entry | null;
  subs: SubGroup[];
};

type MaterialGroup = {
  materialId: string;
  materialTitle: string;
  subject: string;
  problems: ProblemGroup[];
};

const RESULTS = [
  { value: "perfect" as const, label: "完全", color: "#059669", bg: "#ECFDF5", Icon: Check },
  { value: "unsure" as const, label: "不安", color: "#B45309", bg: "#FFFBEB", Icon: TriangleAlert },
  { value: "checked" as const, label: "確認", color: "#1D4ED8", bg: "#EFF6FF", Icon: BookOpen },
  { value: "wrong" as const, label: "不可", color: "#DC2626", bg: "#FEF2F2", Icon: X },
] as const;

const SUBJECT_LABEL = SUBJECT_LABEL_LIB;

const EXAM_SUBJECT_OPTIONS = Object.entries(SUBJECT_LABEL);

const COMMON_EXAMS = [
  "全統記述模試（河合塾）",
  "全統共通テスト模試（河合塾）",
  "駿台全国模試",
  "駿台共通テスト模試",
  "進研模試",
  "東進センター本番レベル模試",
];

type ExamRow = { id: string; subject: string; score: string; max: string; deviation: string };

function emptyAttempts(): AttemptSlot[] {
  return [
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
  ];
}

function createEntry(problemNo: number, originalKey: string | null = null, materialTitle = "", subject = "", materialId = ""): Entry {
  return {
    id: crypto.randomUUID(),
    materialId,
    problemNo,
    subNo: 0,
    subsubNo: 0,
    materialTitle,
    subject,
    memo: "",
    imageUrl: null,
    attempts: emptyAttempts(),
    originalKey,
  };
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${remaining}` : `${minutes}:${remaining}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function keyOf(problemNo: number, subNo: number, subsubNo: number) {
  return `${problemNo}_${subNo}_${subsubNo}`;
}

function labelOf(entry: Entry) {
  let label = entry.materialTitle.trim() ? `${entry.materialTitle.trim()} / 第${entry.problemNo}問` : `第${entry.problemNo}問`;
  if (entry.subNo > 0) label += `-${entry.subNo}`;
  if (entry.subsubNo > 0) label += `-${entry.subsubNo}`;
  return label;
}

function groupEntriesByMaterial(entries: Entry[]): MaterialGroup[] {
  const seen = new Set<string>();
  const materialIds: string[] = [];
  for (const e of entries) {
    if (!seen.has(e.materialId)) { seen.add(e.materialId); materialIds.push(e.materialId); }
  }
  return materialIds.map((materialId) => {
    const group = entries.filter((e) => e.materialId === materialId);
    const first = group[0];
    return {
      materialId,
      materialTitle: first?.materialTitle ?? "",
      subject: first?.subject ?? "",
      problems: groupEntriesByProblem(group),
    };
  });
}

function groupEntriesByProblem(entries: Entry[]): ProblemGroup[] {
  const problemNos = [...new Set(entries.map((e) => e.problemNo))].sort((a, b) => a - b);
  return problemNos.map((problemNo) => {
    const group = entries.filter((e) => e.problemNo === problemNo);
    const baseEntry = group.find((e) => e.subNo === 0 && e.subsubNo === 0) ?? null;
    const subNos = [...new Set(group.filter((e) => e.subNo > 0).map((e) => e.subNo))].sort((a, b) => a - b);
    const subs = subNos.map((subNo) => {
      const subGroup = group.filter((e) => e.subNo === subNo);
      const subBase = subGroup.find((e) => e.subsubNo === 0) ?? null;
      const subsubs = subGroup.filter((e) => e.subsubNo > 0).sort((a, b) => a.subsubNo - b.subsubNo);
      return { subNo, baseEntry: subBase, subsubs };
    });
    const materialTitle = group[0]?.materialTitle ?? "";
    return { problemNo, materialTitle, baseEntry, subs };
  });
}

export default function PracticePage() {
  const router = useRouter();
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("book");
  const [routeBooks, setRouteBooks] = useState<RouteBook[]>([]);
  const [schoolBooks, setSchoolBooks] = useState<BookData[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [book, setBook] = useState<BookData | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [savedEntries, setSavedEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [freeMatForm, setFreeMatForm] = useState({ name: "", count: "3", subject: "" });
  const [expandedMemos, setExpandedMemos] = useState<Set<string>>(new Set());
  const toggleMemo = (id: string) => setExpandedMemos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // 模試入力フォーム
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [examRows, setExamRows] = useState<ExamRow[]>([
    { id: "1", subject: "math", score: "", max: "100", deviation: "" },
  ]);
  const [examTotal, setExamTotal] = useState("");
  const [examTotalMax, setExamTotalMax] = useState("");
  const [examTotalDev, setExamTotalDev] = useState("");
  const [examMemo, setExamMemo] = useState("");
  const [examSaving, setExamSaving] = useState(false);
  const [examSaved, setExamSaved] = useState(false);

  const startRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const sessionStartedAtRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).single();
      if (!student) return;

      const { data: routes } = await supabase
        .from("student_routes")
        .select("id, books(id, title, subject)")
        .eq("student_id", student.id)
        .in("status", ["in_progress", "not_started"])
        .order("step_order", { ascending: true })
        .limit(10);

      const seen = new Set<string>();
      const list = (routes ?? [])
        .filter((route) => route.books)
        .map((route) => ({ routeId: route.id, book: route.books as unknown as RouteBook["book"] }))
        .filter((route) => {
          if (seen.has(route.book.id)) return false;
          seen.add(route.book.id);
          return true;
        });
      setRouteBooks(list);

      const res = await fetch("/api/books?category=school");
      const data = await res.json();
      const schoolData: BookData[] = data.books ?? [];
      setSchoolBooks(schoolData);

      if (list.length > 0) setSelectedBookId(list[0].book.id);
      else if (schoolData.length > 0) setSelectedBookId(schoolData[0].id);
    })();
  }, [supabase]);

  useEffect(() => {
    if (phase !== "running") {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setElapsedMs(accRef.current + (Date.now() - startRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const hasDirtyChanges = useMemo(
    () => JSON.stringify(entries) !== JSON.stringify(savedEntries),
    [entries, savedEntries]
  );

  const freeMaterialGroups = useMemo(
    () => (practiceMode === "free" ? groupEntriesByMaterial(entries) : []),
    [practiceMode, entries]
  );

  const loadBookData = useCallback(
    async (bookId: string) => {
      const [{ data: bookData }, resultsRes] = await Promise.all([
        supabase.from("books").select("id, title, subject, level, total_problems").eq("id", bookId).single(),
        fetch(`/api/problem-results?book_id=${bookId}`),
      ]);
      const resultsJson = await resultsRes.json();
      setBook(bookData as BookData);

      const grouped = new Map<string, Entry>();
      for (const result of resultsJson.results ?? []) {
        const currentKey = keyOf(result.problem_no, result.sub_no ?? 0, result.subsub_no ?? 0);
        if (!grouped.has(currentKey)) {
          grouped.set(currentKey, {
            id: crypto.randomUUID(),
            materialId: "",
            problemNo: result.problem_no,
            subNo: result.sub_no ?? 0,
            subsubNo: result.subsub_no ?? 0,
            materialTitle: "",
            subject: "",
            memo: result.memo ?? "",
            imageUrl: result.image_url ?? null,
            attempts: emptyAttempts(),
            originalKey: currentKey,
          });
        }
        const entry = grouped.get(currentKey)!;
        const index = Math.max(0, Math.min(2, (result.attempt_no ?? 1) - 1));
        entry.attempts[index] = { result: result.result, recorded_at: result.recorded_at };
        if (!entry.memo && result.memo) entry.memo = result.memo;
        if (!entry.imageUrl && result.image_url) entry.imageUrl = result.image_url;
      }

      const nextEntries = grouped.size
        ? Array.from(grouped.values()).sort((a, b) => a.problemNo - b.problemNo || a.subNo - b.subNo || a.subsubNo - b.subsubNo)
        : Array.from({ length: Math.min(10, bookData?.total_problems ?? 10) }, (_, i) => createEntry(i + 1));

      setEntries(nextEntries);
      setSavedEntries(JSON.parse(JSON.stringify(nextEntries)));
    },
    [supabase]
  );

  const handleStart = useCallback(async () => {
    setPhase("loading");
    if (practiceMode === "book" && selectedBookId) {
      await loadBookData(selectedBookId);
    } else {
      setBook(null);
      setEntries([]);
      setSavedEntries([]);
    }
    accRef.current = 0;
    startRef.current = Date.now();
    sessionStartedAtRef.current = new Date().toISOString();
    setElapsedMs(0);
    setPhase("running");
  }, [loadBookData, practiceMode, selectedBookId]);

  const handleExamSave = async () => {
    if (!examName || !examDate) return;
    setExamSaving(true);
    const scores: Record<string, { score: number; max: number; deviation?: number }> = {};
    for (const row of examRows) {
      if (row.score !== "" && row.max !== "") {
        scores[row.subject] = {
          score: Number(row.score),
          max: Number(row.max),
          ...(row.deviation !== "" ? { deviation: Number(row.deviation) } : {}),
        };
      }
    }
    await fetch("/api/mock-exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_name: examName,
        exam_date: examDate,
        scores,
        total_score: examTotal !== "" ? Number(examTotal) : null,
        total_max: examTotalMax !== "" ? Number(examTotalMax) : null,
        total_deviation: examTotalDev !== "" ? Number(examTotalDev) : null,
        memo: examMemo || null,
      }),
    });
    setExamSaving(false);
    setExamSaved(true);
    setExamName("");
    setExamDate(new Date().toISOString().slice(0, 10));
    setExamRows([{ id: "1", subject: "math", score: "", max: "100", deviation: "" }]);
    setExamTotal(""); setExamTotalMax(""); setExamTotalDev(""); setExamMemo("");
    setTimeout(() => setExamSaved(false), 3000);
  };

  const handlePause = () => {
    accRef.current += Date.now() - startRef.current;
    setPhase("paused");
  };

  const handleResume = () => {
    startRef.current = Date.now();
    setPhase("running");
  };

  const defaultSessionTitle = useCallback(() => {
    if (practiceMode === "book") return book?.title ?? "演習";
    if (practiceMode === "free") return "自由演習";
    return "時間記録";
  }, [book?.title, practiceMode]);

  const handleFinish = async () => {
    const finalElapsed = phase === "running" ? elapsedMs : accRef.current;
    accRef.current = finalElapsed;
    cancelAnimationFrame(rafRef.current);
    setElapsedMs(finalElapsed);

    if (practiceMode === "book" && hasDirtyChanges) await saveBookMode();

    if (typeof window !== "undefined") {
      const resultSummary =
        practiceMode === "free"
          ? entries.map((entry) => ({
              label: labelOf(entry),
              attempts: entry.attempts.map((a) => a.result),
            }))
          : null;

      window.sessionStorage.setItem(
        "practiceFinalizeDraft",
        JSON.stringify({
          title: defaultSessionTitle(),
          practiceMode,
          bookId: practiceMode === "book" ? selectedBookId || null : null,
          bookTitle: book?.title ?? null,
          subject: book?.subject ?? null,
          studyMinutes: Math.max(1, Math.round(finalElapsed / 60000)),
          startedAt: sessionStartedAtRef.current,
          endedAt: new Date().toISOString(),
          resultSummary,
        })
      );
    }
    router.push("/practice/finalize");
  };

  const updateEntry = (id: string, updater: (entry: Entry) => Entry) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? updater(e) : e)));
  };

  const uploadEntryImage = useCallback(
    async (entryId: string, file: File) => {
      setUploadingImageId(entryId);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/problem-results/image", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.url) {
        updateEntry(entryId, (entry) => ({ ...entry, imageUrl: json.url }));
      }
      setUploadingImageId(null);
    },
    []
  );

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const removeEntriesForProblem = (problemNo: number) =>
    setEntries((prev) => prev.filter((e) => e.problemNo !== problemNo));

  const removeSubEntries = (problemNo: number, subNo: number) =>
    setEntries((prev) => prev.filter((e) => !(e.problemNo === problemNo && e.subNo === subNo)));

  const updateMaterialTitle = (problemNo: number, title: string) =>
    setEntries((prev) => prev.map((e) => (e.problemNo === problemNo ? { ...e, materialTitle: title } : e)));

  const addProblem = () => {
    const maxNo = entries.length > 0 ? Math.max(...entries.map((e) => e.problemNo)) : 0;
    setEntries((prev) => [...prev, createEntry(maxNo + 1)]);
  };

  const addSubEntry = (problemNo: number, materialTitle: string) => {
    const maxSubNo = Math.max(0, ...entries.filter((e) => e.problemNo === problemNo && e.subNo > 0).map((e) => e.subNo));
    const entry = createEntry(problemNo, null, materialTitle);
    entry.subNo = maxSubNo + 1;
    setEntries((prev) => [...prev, entry]);
  };

  const addSubSubEntry = (problemNo: number, subNo: number, materialTitle: string) => {
    const maxSubSubNo = Math.max(
      0,
      ...entries.filter((e) => e.problemNo === problemNo && e.subNo === subNo && e.subsubNo > 0).map((e) => e.subsubNo)
    );
    const entry = createEntry(problemNo, null, materialTitle);
    entry.subNo = subNo;
    entry.subsubNo = maxSubSubNo + 1;
    setEntries((prev) => [...prev, entry]);
  };

  const toggleAttemptExpand = (entryId: string) => {
    setExpandedAttempts((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };


  const saveBookMode = useCallback(async () => {
    if (practiceMode !== "book" || !selectedBookId || saving) return;
    setSaving(true);
    const previousMap = new Map(savedEntries.map((e) => [e.id, e]));

    for (const oldEntry of savedEntries) {
      const stillExists = entries.find((e) => e.id === oldEntry.id);
      if (!stillExists && oldEntry.originalKey) {
        const [problemNo, subNo, subsubNo] = oldEntry.originalKey.split("_").map(Number);
        for (const attemptNo of [1, 2, 3]) {
          await fetch(`/api/problem-results?book_id=${selectedBookId}&problem_no=${problemNo}&sub_no=${subNo}&subsub_no=${subsubNo}&attempt_no=${attemptNo}`, { method: "DELETE" });
        }
      }
    }

    for (const entry of entries) {
      const previous = previousMap.get(entry.id);
      const currentKey = keyOf(entry.problemNo, entry.subNo, entry.subsubNo);
      const previousKey = previous?.originalKey ?? (previous ? keyOf(previous.problemNo, previous.subNo, previous.subsubNo) : null);

      if (previousKey && previousKey !== currentKey) {
        const [oldProblemNo, oldSubNo, oldSubsubNo] = previousKey.split("_").map(Number);
        for (const attemptNo of [1, 2, 3]) {
          await fetch(`/api/problem-results?book_id=${selectedBookId}&problem_no=${oldProblemNo}&sub_no=${oldSubNo}&subsub_no=${oldSubsubNo}&attempt_no=${attemptNo}`, { method: "DELETE" });
        }
      }

      for (let i = 0; i < 3; i++) {
        const attemptNo = i + 1;
        const currentResult = entry.attempts[i]?.result ?? null;
        const previousResult = previous?.attempts[i]?.result ?? null;

        if (!currentResult && previousResult) {
          await fetch(`/api/problem-results?book_id=${selectedBookId}&problem_no=${entry.problemNo}&sub_no=${entry.subNo}&subsub_no=${entry.subsubNo}&attempt_no=${attemptNo}`, { method: "DELETE" });
        }
        if (currentResult) {
          await fetch("/api/problem-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              book_id: selectedBookId,
              problem_no: entry.problemNo,
              sub_no: entry.subNo,
              subsub_no: entry.subsubNo,
              attempt_no: attemptNo,
              result: currentResult,
              memo: entry.memo,
              image_url: entry.imageUrl,
            }),
          });
        }
      }
    }

    const latest = entries.map((e) => ({ ...e, originalKey: keyOf(e.problemNo, e.subNo, e.subsubNo) }));
    setEntries(latest);
    setSavedEntries(JSON.parse(JSON.stringify(latest)));
    setSaving(false);
  }, [entries, practiceMode, saving, savedEntries, selectedBookId]);

  const currentTitle =
    practiceMode === "book" ? (book?.title ?? "演習") :
    practiceMode === "free" ? "自由演習" : "時間記録";

  const currentMeta =
    practiceMode === "book"
      ? `${SUBJECT_LABEL[book?.subject ?? ""] ?? "—"} / ${book?.total_problems ?? 0}問`
      : practiceMode === "free"
        ? `教材 ${freeMaterialGroups.length}件 / 問題 ${entries.filter(e => e.subNo === 0 && e.subsubNo === 0).length}問`
        : "学習時間を記録中";

  return (
    <AppLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 16px 80px", display: "grid", gap: 12 }}>

        {/* ════ Idle: セットアップ ════ */}
        {phase === "idle" && (
          <section style={panelStyle}>
            <div style={{ display: "grid", gap: 14 }}>
              {/* モードタブ */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([
                  { mode: "book" as const, Icon: BookOpen, title: "教材演習" },
                  { mode: "free" as const, Icon: GraduationCap, title: "自由演習" },
                  { mode: "time" as const, Icon: Clock3, title: "時間記録" },
                  { mode: "exam" as const, Icon: ClipboardList, title: "模試入力" },
                ] as const).map(({ mode, Icon, title }) => (
                  <button key={mode} onClick={() => setPracticeMode(mode)} style={modeTabStyle(practiceMode === mode)}>
                    <Icon size={14} /> {title}
                  </button>
                ))}</div>

                {/* 教材モード: 教材選択 */}
                {practiceMode === "book" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {routeBooks.length === 0 && schoolBooks.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                        使える教材がありません。教材ページから追加するか、ルートに登録してください。
                      </p>
                    ) : (
                      <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} style={selectStyle}>
                        {routeBooks.length > 0 && (
                          <optgroup label="ルートの教材">
                            {routeBooks.map((item) => (
                              <option key={item.book.id} value={item.book.id}>{item.book.title}</option>
                            ))}
                          </optgroup>
                        )}
                        {schoolBooks.length > 0 && (
                          <optgroup label="学校の教材">
                            {schoolBooks.map((b) => (
                              <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>
                )}

                {/* 自由演習モード */}
                {practiceMode === "free" && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    演習中に教材を追加して、大問ごとに結果を記録できます。
                  </p>
                )}

                {/* 模試入力モード */}
                {practiceMode === "exam" && (
                  <div style={{ display: "grid", gap: 12 }}>
                    {/* 模試名 */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                      <input
                        list="exam-names"
                        value={examName}
                        onChange={(e) => setExamName(e.target.value)}
                        placeholder="模試名を入力（例：全統記述模試）"
                        style={inputStyle}
                      />
                      <input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        style={{ ...inputStyle, width: 140 }}
                      />
                      <datalist id="exam-names">
                        {COMMON_EXAMS.map((n) => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                    {/* 科目別スコア */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 70px auto", gap: 6, alignItems: "center" }}>
                        <span style={examColLabel}>科目</span>
                        <span style={examColLabel}>得点</span>
                        <span style={examColLabel}>満点</span>
                        <span style={examColLabel}>偏差値</span>
                        <span />
                      </div>
                      {examRows.map((row) => (
                        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 70px auto", gap: 6, alignItems: "center" }}>
                          <select value={row.subject} onChange={(e) => setExamRows((prev) => prev.map((r) => r.id === row.id ? { ...r, subject: e.target.value } : r))} style={{ ...inputStyle, padding: "7px 8px" }}>
                            {EXAM_SUBJECT_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <input type="number" value={row.score} onChange={(e) => setExamRows((prev) => prev.map((r) => r.id === row.id ? { ...r, score: e.target.value } : r))} placeholder="—" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                          <input type="number" value={row.max} onChange={(e) => setExamRows((prev) => prev.map((r) => r.id === row.id ? { ...r, max: e.target.value } : r))} placeholder="100" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                          <input type="number" value={row.deviation} onChange={(e) => setExamRows((prev) => prev.map((r) => r.id === row.id ? { ...r, deviation: e.target.value } : r))} placeholder="—" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                          <button onClick={() => setExamRows((prev) => prev.filter((r) => r.id !== row.id))} style={iconDeleteButtonStyle} disabled={examRows.length === 1}><X size={12} /></button>
                        </div>
                      ))}
                      <button onClick={() => setExamRows((prev) => [...prev, { id: String(Date.now()), subject: "english", score: "", max: "100", deviation: "" }])} style={ghostButtonStyle}>
                        <Plus size={13} /> 科目を追加
                      </button>
                    </div>
                    {/* 合計 */}
                    <div style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 70px auto", gap: 6, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>合計</span>
                      <input type="number" value={examTotal} onChange={(e) => setExamTotal(e.target.value)} placeholder="—" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                      <input type="number" value={examTotalMax} onChange={(e) => setExamTotalMax(e.target.value)} placeholder="—" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                      <input type="number" value={examTotalDev} onChange={(e) => setExamTotalDev(e.target.value)} placeholder="—" style={{ ...inputStyle, padding: "7px 8px", textAlign: "right" }} />
                      <span />
                    </div>
                    {/* メモ */}
                    <input value={examMemo} onChange={(e) => setExamMemo(e.target.value)} placeholder="メモ（任意）" style={inputStyle} />
                    {/* 保存ボタン */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={() => void handleExamSave()} disabled={!examName || !examDate || examSaving} style={primaryButtonStyle}>
                        <Save size={15} /> {examSaving ? "保存中..." : "模試を保存"}
                      </button>
                      {examSaved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>✓ 保存しました</span>}
                    </div>
                  </div>
                )}

                {/* タイマー開始ボタン (exam以外) */}
                {practiceMode !== "exam" && (
                  <button
                    onClick={() => void handleStart()}
                    disabled={practiceMode === "book" && !selectedBookId}
                    style={primaryButtonStyle}
                  >
                    <Play size={16} strokeWidth={2.4} />
                    記録を始める
                  </button>
                )}
            </div>
          </section>
        )}

        {phase === "loading" && (
          <section style={panelStyle}>
            <div style={{ minHeight: 180, display: "grid", placeItems: "center" }}>
              <div style={spinnerStyle} />
            </div>
          </section>
        )}

        {/* ════ Running/Paused: タイマー ════ */}
        {(phase === "running" || phase === "paused" || phase === "done") && (
          <>
            <section style={timerPanelStyle(phase)}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: phase === "running" ? "rgba(255,255,255,0.82)" : "var(--text-muted)" }}>{currentTitle}</p>
                <p style={{ margin: "6px 0 0", fontSize: 50, fontWeight: 900, lineHeight: 1, fontFamily: "monospace", letterSpacing: -2, color: phase === "running" ? "#fff" : "var(--text-primary)" }}>{formatTime(elapsedMs)}</p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: phase === "running" ? "rgba(255,255,255,0.72)" : "var(--text-secondary)" }}>{currentMeta}</p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {phase === "running" ? (
                  <button onClick={handlePause} style={timerActionStyle(true)}><Pause size={13} /> 一時停止</button>
                ) : phase !== "done" ? (
                  <button onClick={handleResume} style={timerActionStyle(false)}><Play size={13} /> 再開する</button>
                ) : null}
                {phase !== "done" && (
                  <button onClick={() => void handleFinish()} style={finishButtonStyle}><Square size={13} /> 記録を終了する</button>
                )}
              </div>
            </section>

            {/* ════ 自由演習: 教材ごとの記録 ════ */}
            {practiceMode === "free" && (
              <section style={panelStyle}>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Record</p>
                  <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>演習シート</h2>
                </div>

                {/* 教材追加フォーム */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: 14 }}>
                  <label style={{ display: "grid", gap: 4, flex: 2, minWidth: 120 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>教材名</span>
                    <input
                      value={freeMatForm.name}
                      onChange={(e) => setFreeMatForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例: 青チャート"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, width: 80 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>大問数</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={freeMatForm.count}
                      onChange={(e) => setFreeMatForm((f) => ({ ...f, count: e.target.value }))}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, width: 110 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>科目</span>
                    <select
                      value={freeMatForm.subject}
                      onChange={(e) => setFreeMatForm((f) => ({ ...f, subject: e.target.value }))}
                      style={selectStyle}
                    >
                      <option value="">— 選択 —</option>
                      {EXAM_SUBJECT_OPTIONS.map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      const count = Math.max(1, Number(freeMatForm.count) || 1);
                      const materialId = crypto.randomUUID();
                      const newEntries = Array.from({ length: count }, (_, i) =>
                        createEntry(i + 1, null, freeMatForm.name, freeMatForm.subject, materialId)
                      );
                      setEntries((prev) => [...prev, ...newEntries]);
                      setFreeMatForm((f) => ({ ...f, name: "", count: "3" }));
                    }}
                    disabled={!freeMatForm.name.trim()}
                    style={{ ...primaryButtonStyle, alignSelf: "flex-end" }}
                  >
                    <Plus size={14} /> 追加
                  </button>
                </div>

                {/* 教材ごとのテーブル */}
                {freeMaterialGroups.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    上のフォームから演習シートを追加してください
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16 }}>
                    {freeMaterialGroups.map((mat) => {
                      const matEntries = entries.filter((e) => e.materialId === mat.materialId);
                      return (
                        <div key={mat.materialId}>
                          {/* 教材ヘッダー */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", flex: 1 }}>{mat.materialTitle || "（教材名なし）"}</span>
                            {mat.subject && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#3157B7", background: "#EEF4FF", border: "1px solid rgba(49,87,183,0.14)", borderRadius: 999, padding: "2px 8px" }}>
                                {SUBJECT_LABEL[mat.subject] ?? mat.subject}
                              </span>
                            )}
                            <button
                              onClick={() => setEntries((prev) => prev.filter((e) => e.materialId !== mat.materialId))}
                              style={xlIconBtn} title="この教材を削除"
                            ><Trash2 size={11} /></button>
                          </div>
                          {/* book modeと同じフラットテーブル */}
                          <div style={{ overflowX: "auto" }}>
                            <div style={xlTableWrap}>
                              <div style={xlThead}>
                                <div style={{ ...xlTh, width: 28 }}>#</div>
                                <div style={{ ...xlTh, width: 54 }}>大問</div>
                                <div style={{ ...xlTh, width: 54 }}>中問</div>
                                <div style={{ ...xlTh, width: 54 }}>小問</div>
                                <div style={{ ...xlTh, width: 42 }}>1回</div>
                                <div style={{ ...xlTh, width: 42 }}>2回</div>
                                <div style={{ ...xlTh, width: 42 }}>3回</div>
                                <div style={{ ...xlTh, flex: 1 }}>メモ</div>
                                <div style={{ ...xlTh, width: 82, border: "none" }} />
                              </div>
                              {matEntries.map((entry, rowIdx) => (
                                <div key={entry.id} style={xlTr(entry.subNo > 0 ? (entry.subsubNo > 0 ? 2 : 1) : 0)}>
                                  <div style={{ ...xlTd, width: 28, justifyContent: "center" }}>
                                    <span style={{ fontSize: 11, color: "#CBD5E1" }}>{rowIdx + 1}</span>
                                  </div>
                                  <div style={{ ...xlTd, width: 54, justifyContent: "center" }}>
                                    <input type="number" min={1} value={entry.problemNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, problemNo: Math.max(1, Number(e.target.value) || 1) }))} style={xlNumInput} />
                                  </div>
                                  <div style={{ ...xlTd, width: 54, justifyContent: "center" }}>
                                    <input type="number" min={0} value={entry.subNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, subNo: Math.max(0, Number(e.target.value) || 0) }))} style={xlNumInput} />
                                  </div>
                                  <div style={{ ...xlTd, width: 54, justifyContent: "center" }}>
                                    <input type="number" min={0} value={entry.subsubNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, subsubNo: Math.max(0, Number(e.target.value) || 0) }))} style={xlNumInput} />
                                  </div>
                                  {[0, 1, 2].map((idx) => (
                                    <div key={idx} style={{ ...xlTd, width: 42, justifyContent: "center" }}>
                                      <ResultMark
                                        value={entry.attempts[idx].result}
                                        onChange={(v) => updateEntry(entry.id, (c) => {
                                          const a = [...c.attempts]; a[idx] = { result: v, recorded_at: v ? new Date().toISOString() : null };
                                          return { ...c, attempts: a };
                                        })}
                                      />
                                    </div>
                                  ))}
                                  <div style={{ ...xlTd, flex: 1 }}>
                                    <textarea value={entry.memo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, memo: e.target.value }))} placeholder="メモ" rows={1} style={xlMemoInput} />
                                  </div>
                                  <div style={{ ...xlTd, width: 82, border: "none", gap: 4 }}>
                                    {entry.subNo === 0 && (
                                      <button
                                        onClick={() => {
                                          const maxSub = Math.max(0, ...matEntries.filter((e) => e.problemNo === entry.problemNo && e.subNo > 0).map((e) => e.subNo));
                                          const ne = createEntry(entry.problemNo, null, mat.materialTitle, mat.subject, mat.materialId);
                                          ne.subNo = maxSub + 1;
                                          setEntries((prev) => [...prev, ne]);
                                        }}
                                        style={xlAddMiniBtn}
                                      ><Plus size={10} />中問</button>
                                    )}
                                    {entry.subNo > 0 && entry.subsubNo === 0 && (
                                      <button
                                        onClick={() => {
                                          const maxSub = Math.max(0, ...matEntries.filter((e) => e.problemNo === entry.problemNo && e.subNo === entry.subNo && e.subsubNo > 0).map((e) => e.subsubNo));
                                          const ne = createEntry(entry.problemNo, null, mat.materialTitle, mat.subject, mat.materialId);
                                          ne.subNo = entry.subNo;
                                          ne.subsubNo = maxSub + 1;
                                          setEntries((prev) => [...prev, ne]);
                                        }}
                                        style={xlAddMiniBtn}
                                      ><Plus size={10} />小問</button>
                                    )}
                                    <button onClick={() => removeEntry(entry.id)} style={xlIconBtn} title="削除"><Trash2 size={11} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const maxNo = matEntries.length > 0 ? Math.max(...matEntries.map((e) => e.problemNo)) : 0;
                              setEntries((prev) => [...prev, createEntry(maxNo + 1, null, mat.materialTitle, mat.subject, mat.materialId)]);
                            }}
                            style={{ ...ghostButtonStyle, marginTop: 6, fontSize: 12, padding: "7px 12px" }}
                          >
                            <Plus size={13} /> 行を追加
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ════ 教材記録: テーブル ════ */}
            {practiceMode === "book" && (
              <section style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Record</p>
                    <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>教材の記録シート</h2>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEntries((prev) => [...prev, createEntry(Math.max(...prev.map((e) => e.problemNo), 0) + 1)])} style={ghostButtonStyle}>
                      <Plus size={14} /> 行を追加
                    </button>
                    <button onClick={() => void saveBookMode()} disabled={!hasDirtyChanges || saving} style={primaryButtonStyle}>
                      <Save size={15} /> {saving ? "保存中..." : "記録を保存"}
                    </button>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <div style={xlTableWrap}>
                    <div style={xlThead}>
                      <div style={{ ...xlTh, width: 38 }}>大問</div>
                      <div style={{ ...xlTh, width: 38 }}>中問</div>
                      <div style={{ ...xlTh, width: 38 }}>小問</div>
                      <div style={{ ...xlTh, width: 34 }}>1回</div>
                      <div style={{ ...xlTh, width: 34 }}>2回</div>
                      <div style={{ ...xlTh, width: 34 }}>3回</div>
                      <div style={{ ...xlTh, flex: 1, minWidth: 60 }}>メモ</div>
                      <div style={{ ...xlTh, width: 68, border: "none" }} />
                    </div>
                    {entries.map((entry) => (
                      <Fragment key={entry.id}>
                        <div style={xlTr(entry.subNo > 0 ? (entry.subsubNo > 0 ? 2 : 1) : 0)}>
                          <div style={{ ...xlTd, width: 38, justifyContent: "center" }}>
                            <input type="number" min={1} value={entry.problemNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, problemNo: Math.max(1, Number(e.target.value) || 1) }))} style={xlNumInput} />
                          </div>
                          <div style={{ ...xlTd, width: 38, justifyContent: "center" }}>
                            <input type="number" min={0} value={entry.subNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, subNo: Math.max(0, Number(e.target.value) || 0) }))} style={xlNumInput} />
                          </div>
                          <div style={{ ...xlTd, width: 38, justifyContent: "center" }}>
                            <input type="number" min={0} value={entry.subsubNo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, subsubNo: Math.max(0, Number(e.target.value) || 0) }))} style={xlNumInput} />
                          </div>
                          {[0, 1, 2].map((idx) => (
                            <div key={idx} style={{ ...xlTd, width: 34, justifyContent: "center" }}>
                              <ResultMark
                                value={entry.attempts[idx].result}
                                onChange={(v) => updateEntry(entry.id, (c) => {
                                  const a = [...c.attempts]; a[idx] = { result: v, recorded_at: v ? new Date().toISOString() : null };
                                  return { ...c, attempts: a };
                                })}
                              />
                            </div>
                          ))}
                          <div style={{ ...xlTd, flex: 1, minWidth: 60 }}>
                            {expandedMemos.has(entry.id)
                              ? <textarea value={entry.memo} onChange={(e) => updateEntry(entry.id, (c) => ({ ...c, memo: e.target.value }))} placeholder="メモ" rows={1} style={xlMemoInput} autoFocus />
                              : <span style={{ fontSize: 12, color: entry.memo ? "#475569" : "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{entry.memo || "—"}</span>
                            }
                          </div>
                          <div style={{ ...xlTd, width: 68, border: "none", gap: 3 }}>
                            <button onClick={() => toggleMemo(entry.id)} style={{ ...xlIconBtn, color: entry.memo ? "#3157B7" : "#94A3B8" }} title="メモ"><AlignLeft size={10} /></button>
                            {entry.subNo === 0 && (
                              <button
                                onClick={() => {
                                  const maxSub = Math.max(0, ...entries.filter((e) => e.problemNo === entry.problemNo && e.subNo > 0).map((e) => e.subNo));
                                  const ne = createEntry(entry.problemNo, null);
                                  ne.subNo = maxSub + 1;
                                  setEntries((prev) => [...prev, ne]);
                                }}
                                style={xlAddMiniBtn} title="中問を追加"
                              ><Plus size={10} />中</button>
                            )}
                            {entry.subNo > 0 && entry.subsubNo === 0 && (
                              <button
                                onClick={() => {
                                  const maxSub = Math.max(0, ...entries.filter((e) => e.problemNo === entry.problemNo && e.subNo === entry.subNo && e.subsubNo > 0).map((e) => e.subsubNo));
                                  const ne = createEntry(entry.problemNo, null);
                                  ne.subNo = entry.subNo;
                                  ne.subsubNo = maxSub + 1;
                                  setEntries((prev) => [...prev, ne]);
                                }}
                                style={xlAddMiniBtn} title="小問を追加"
                              ><Plus size={10} />小</button>
                            )}
                            <button onClick={() => removeEntry(entry.id)} style={xlIconBtn} title="削除"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ════ EntryAttempts コンポーネント ════
function EntryAttempts({
  entry,
  expanded,
  onToggleExpand,
  onUpdate,
  indent,
  showAsk,
  bookTitle,
}: {
  entry: Entry;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updater: (e: Entry) => Entry) => void;
  indent: number;
  showAsk: boolean;
  bookTitle?: string;
}) {
  const attempt0 = entry.attempts[0];
  const hasLaterAttempts = entry.attempts.slice(1).some((a) => a.result !== null);
  const paddingLeft = indent * 20;

  return (
    <div style={{ paddingLeft, display: "grid", gap: 6 }}>
      {/* 1蝗樒岼 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {RESULTS.map((result) => {
          const selected = attempt0.result === result.value;
          return (
            <button
              key={result.value}
              onClick={() =>
                onUpdate(entry.id, (c) => {
                  const next = [...c.attempts];
                  next[0] = { result: selected ? null : result.value, recorded_at: selected ? null : new Date().toISOString() };
                  return { ...c, attempts: next };
                })
              }
              style={resultChipStyle(selected, result.color, result.bg)}
            >
              <result.Icon size={13} /> {result.label}
            </button>
          );
        })}
        <button
          onClick={onToggleExpand}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          title="2回目・3回目の記録"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {hasLaterAttempts ? "履歴あり" : "2回目以降"}
        </button>
        {showAsk && (
          <button
            onClick={() => {
              const prefix = bookTitle ? `『${bookTitle}』 ` : "";
              window.location.href = `/my-sensei?mode=question&query=${encodeURIComponent(`${prefix}${labelOf(entry)}が解けません。考え方から教えてください。`)}`;
            }}
            style={askButtonStyle}
          >
            <GraduationCap size={13} /> AIに質問
          </button>
        )}
      </div>

      {/* 2回目・3回目（条件付き） */}
      {expanded && (
        <div style={{ display: "grid", gap: 4, paddingLeft: 4 }}>
          {entry.attempts.slice(1).map((attempt, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", minWidth: 36 }}>{i + 2}回目</span>
              {attempt.recorded_at && (
                <span style={{ fontSize: 11, color: "#CBD5E1" }}>{formatDate(attempt.recorded_at)}</span>
              )}
              {RESULTS.map((result) => {
                const selected = attempt.result === result.value;
                return (
                  <button
                    key={result.value}
                    onClick={() =>
                      onUpdate(entry.id, (c) => {
                        const next = [...c.attempts];
                        next[i + 1] = { result: selected ? null : result.value, recorded_at: selected ? null : new Date().toISOString() };
                        return { ...c, attempts: next };
                      })
                    }
                    style={{ ...resultChipStyle(selected, result.color, result.bg), padding: "6px 9px", fontSize: 11 }}
                  >
                    <result.Icon size={11} /> {result.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════ ResultMark: クリックで結果を切り替える小さなセル ════
function ResultMark({ value, onChange }: { value: ResultVal | null; onChange: (v: ResultVal | null) => void }) {
  const ORDER: (ResultVal | null)[] = [null, "perfect", "unsure", "checked", "wrong"];
  const r = RESULTS.find((x) => x.value === value);
  return (
    <button
      type="button"
      onClick={() => onChange(ORDER[(ORDER.indexOf(value) + 1) % ORDER.length])}
      title={r?.label ?? "タップで記録"}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: r ? `1.5px solid ${r.color}` : "1.5px solid #D1D5DB",
        background: r ? r.bg : "#F9FAFB",
        color: r ? r.color : "#CBD5E1",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {r ? <r.Icon size={12} strokeWidth={2.5} /> : <span style={{ fontSize: 11, lineHeight: 1 }}>—</span>}
    </button>
  );
}

// ════ スタイル定義 ════
const heroStyle: React.CSSProperties = {
  borderRadius: 24, padding: 22,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
};
const heroEyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" };
const heroTitleStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: 28, lineHeight: 1.15, color: "#0F172A" };
const heroTextStyle: React.CSSProperties = { margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "#64748B", maxWidth: 640 };

const panelStyle: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const timerPanelStyle = (phase: Phase): React.CSSProperties => ({
  borderRadius: 18, padding: "20px 22px",
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
  background: phase === "running" ? "linear-gradient(135deg, var(--accent), #5B73D4)" : "var(--bg-card)",
  border: phase === "running" ? "none" : "1px solid var(--border)",
  boxShadow: phase === "running" ? "0 8px 22px rgba(59,82,180,0.24)" : "0 1px 4px rgba(0,0,0,0.06)",
});

const primaryButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, var(--accent), #5B73D4)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" };
const ghostButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const finishButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const timerActionStyle = (running: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: running ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--border)", background: running ? "rgba(255,255,255,0.16)" : "var(--bg-elevated)", color: running ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" });

const setupGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)", gap: 14, alignItems: "start" };
const setupCardStyle: React.CSSProperties = { padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "#fff", display: "grid", gap: 12 };

const entryChoiceGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 };
const entryChoiceCardStyle = (active: boolean): React.CSSProperties => ({ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, alignItems: "start", padding: "14px 15px", borderRadius: 16, border: active ? "1px solid rgba(49,87,183,0.24)" : "1px solid var(--border)", background: active ? "#F8FAFF" : "#fff", boxShadow: active ? "0 6px 18px rgba(49,87,183,0.08)" : "none", cursor: "pointer" });
const entryChoiceIconStyle = (active: boolean): React.CSSProperties => ({ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: active ? "#E0EAFF" : "#EEF2F6", color: active ? "var(--accent)" : "#475467" });
const entryChoiceTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "var(--text-primary)" };
const entryChoiceTextStyle: React.CSSProperties = { fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" };
const modeTabStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: active ? "1px solid rgba(49,87,183,0.3)" : "1px solid var(--border)", background: active ? "#EEF4FF" : "#fff", color: active ? "var(--accent)" : "var(--text-secondary)", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" });
const miniToggleStyle = (active: boolean): React.CSSProperties => ({ padding: "7px 12px", borderRadius: 999, border: active ? "1px solid rgba(49,87,183,0.18)" : "1px solid var(--border)", background: active ? "#EEF4FF" : "#fff", color: active ? "var(--accent)" : "var(--text-secondary)", fontSize: 12, fontWeight: 800, cursor: "pointer" });
const examColLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" };

const helperStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 };
const selectStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-elevated)", fontSize: 14, color: "var(--text-primary)", outline: "none" };
const freeBoxStyle: React.CSSProperties = { padding: "14px 16px", borderRadius: 16, background: "var(--bg-elevated)", border: "1px solid var(--border)" };

// 問題リスト用スタイル
const problemGroupCardStyle: React.CSSProperties = { borderRadius: 16, border: "1px solid var(--border)", background: "#fff", padding: "14px 16px", display: "grid", gap: 10 };
const problemHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const problemNoStyle: React.CSSProperties = { fontSize: 14, fontWeight: 900, color: "#0F172A", minWidth: 52, flexShrink: 0 };
const materialTitleInputStyle: React.CSSProperties = { flex: 1, minWidth: 120, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-elevated)", fontSize: 13, color: "var(--text-primary)", outline: "none" };
const addSubButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(49,87,183,0.16)", background: "#EEF4FF", color: "var(--accent)", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const iconDeleteButtonStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "#94A3B8", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const subGroupStyle: React.CSSProperties = { paddingLeft: 20, display: "grid", gap: 6, borderLeft: "2px solid #F1F5F9" };
const subHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const subNoStyle: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "#64748B" };

// 教材記録用テーブルスタイル
const sheetBoardStyle: React.CSSProperties = { borderRadius: 18, border: "1px solid var(--border)", background: "#fff", overflow: "hidden" };
const sheetHeaderRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(160px, 1.4fr) 92px 92px 1fr auto", gap: 10, alignItems: "center", padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid rgba(148,163,184,0.14)" };
const sheetRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(160px, 1.4fr) 92px 92px 1fr auto", gap: 10, alignItems: "start", padding: 14, borderBottom: "1px solid rgba(148,163,184,0.12)" };
const sheetLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 6 };
const fieldLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", fontSize: 14, color: "var(--text-primary)", outline: "none", boxSizing: "border-box" };
const iconButtonStyle: React.CSSProperties = { width: 40, height: 40, marginTop: 18, borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const askButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(49,87,183,0.12)", background: "#EEF4FF", color: "var(--accent)", fontSize: 11, fontWeight: 800, cursor: "pointer" };
const attemptRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, alignItems: "center" };

const spinnerStyle: React.CSSProperties = { width: 36, height: 36, margin: "0 auto", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" };

function resultChipStyle(active: boolean, color: string, bg: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 999, border: active ? `1px solid ${color}` : "1px solid var(--border)", background: active ? bg : "#fff", color: active ? color : "var(--text-secondary)", fontSize: 12, fontWeight: 800, cursor: "pointer" };
}

// ════ Excel テーブル用スタイル ════
const xlTableWrap: React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", background: "#fff" };
const xlThead: React.CSSProperties = { display: "flex", background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" };
const xlTh: React.CSSProperties = { padding: "8px 8px", fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #E2E8F0", flexShrink: 0, display: "flex", alignItems: "center" };
const xlTr = (indent: number): React.CSSProperties => ({ display: "flex", background: indent === 0 ? "#fff" : indent === 1 ? "#FAFBFD" : "#F8FAFB", borderBottom: "1px solid #F1F5F9", minHeight: 38, alignItems: "center" });
const xlTd: React.CSSProperties = { padding: "4px 8px", borderRight: "1px solid #F1F5F9", display: "flex", alignItems: "center", flexShrink: 0, minHeight: 38 };
const xlInlineInput: React.CSSProperties = { width: "100%", padding: "4px 6px", border: "1px solid transparent", borderRadius: 6, background: "transparent", fontSize: 13, color: "var(--text-primary)", outline: "none" };
const xlNumInput: React.CSSProperties = { width: "100%", padding: "4px 2px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#fff", fontSize: 13, color: "var(--text-primary)", outline: "none", textAlign: "center" };
const xlMemoInput: React.CSSProperties = { width: "100%", padding: "4px 6px", border: "none", borderRadius: 6, background: "transparent", fontSize: 12, color: "var(--text-primary)", outline: "none", resize: "none", fontFamily: "inherit" };
const xlAddMiniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 2, padding: "3px 7px", borderRadius: 6, border: "1px solid rgba(49,87,183,0.2)", background: "#EEF4FF", color: "var(--accent)", fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
const xlIconBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 5, border: "1px solid #E2E8F0", background: "#fff", color: "#94A3B8", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 };
