"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ImagePlus, Trash2, X } from "lucide-react";
import { SUBJECT_LABEL } from "@/lib/types";

type BookData = {
  id: string; title: string; subject: string;
  total_problems: number;
};

type AttemptSlot = {
  result: "perfect" | "unsure" | "checked" | "wrong" | null;
  recorded_at: string | null;
};

type ProblemNote = {
  id?: string;
  memo: string;
  images: string[];
};

const RESULTS = [
  { value: "perfect" as const, short: "完全", color: "#059669", bg: "#ECFDF5" },
  { value: "unsure"  as const, short: "不安", color: "#B45309", bg: "#FFFBEB" },
  { value: "checked" as const, short: "確認", color: "#1D4ED8", bg: "#EFF6FF" },
  { value: "wrong"   as const, short: "不可", color: "#DC2626", bg: "#FEF2F2" },
] as const;

function parseKey(key: string): [number, number, number] {
  const parts = key.split("-").map(Number);
  return [parts[0] ?? 1, parts[1] ?? 0, parts[2] ?? 0];
}

function formatKey(pno: number, sno: number, ssno: number) {
  return `${pno}-${sno}-${ssno}`;
}

function problemLabel(pno: number, sno: number, ssno: number) {
  if (sno === 0) return `第${pno}問`;
  if (ssno === 0) return `第${pno}問 (${sno})`;
  return `第${pno}問 (${sno}-${ssno})`;
}

export default function ProblemDetailPage() {
  const { bookId, key } = useParams<{ bookId: string; key: string }>();
  const router = useRouter();
  const [pno, sno, ssno] = parseKey(key);

  const [book, setBook] = useState<BookData | null>(null);
  const [subStructure, setSubStructure] = useState<Record<number, number>>({});
  const [subsubStructure, setSubsubStructure] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<AttemptSlot[]>([
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
    { result: null, recorded_at: null },
  ]);
  const [note, setNote] = useState<ProblemNote>({ memo: "", images: [] });
  const [loading, setLoading] = useState(true);
  const [savingMemo, setSavingMemo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showList, setShowList] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 全問題キーのリストを構築
  const allKeys: string[] = [];
  if (book) {
    for (let p = 1; p <= book.total_problems; p++) {
      const subCount = subStructure[p] ?? 0;
      if (subCount === 0) {
        allKeys.push(formatKey(p, 0, 0));
      } else {
        for (let s = 1; s <= subCount; s++) {
          const ssCount = subsubStructure[`${p}_${s}`] ?? 0;
          if (ssCount === 0) {
            allKeys.push(formatKey(p, s, 0));
          } else {
            for (let ss = 1; ss <= ssCount; ss++) {
              allKeys.push(formatKey(p, s, ss));
            }
          }
        }
      }
    }
  }

  const currentIdx = allKeys.indexOf(key);
  const prevKey = currentIdx > 0 ? allKeys[currentIdx - 1] : null;
  const nextKey = currentIdx < allKeys.length - 1 ? allKeys[currentIdx + 1] : null;

  const load = useCallback(async () => {
    setLoading(true);
    const [bookRes, resultsRes, noteRes] = await Promise.all([
      fetch(`/api/shelf/book?book_id=${bookId}`),
      fetch(`/api/problem-results?book_id=${bookId}`),
      fetch(`/api/problem-notes?book_id=${bookId}&problem_no=${pno}&sub_no=${sno}&subsub_no=${ssno}`),
    ]);
    const bookJson    = await bookRes.json();
    const resultsJson = await resultsRes.json();
    const noteJson    = await noteRes.json();

    setBook(bookJson.book);
    setSubStructure(resultsJson.subStructure ?? {});
    setSubsubStructure(resultsJson.subsubStructure ?? {});

    // この問題のスロットを取り出す
    const relevant = (resultsJson.results ?? []).filter(
      (r: { problem_no: number; sub_no: number; subsub_no: number }) =>
        r.problem_no === pno && (r.sub_no ?? 0) === sno && (r.subsub_no ?? 0) === ssno
    );
    const s: AttemptSlot[] = [
      { result: null, recorded_at: null },
      { result: null, recorded_at: null },
      { result: null, recorded_at: null },
    ];
    for (const r of relevant) {
      const idx = (r.attempt_no ?? 1) - 1;
      if (idx >= 0 && idx < 3) s[idx] = { result: r.result, recorded_at: r.recorded_at };
    }
    setSlots(s);
    setNote(noteJson.note ? { memo: noteJson.note.memo, images: noteJson.note.images ?? [] } : { memo: "", images: [] });
    setLoading(false);
  }, [bookId, pno, sno, ssno]);

  useEffect(() => { void load(); }, [load]);

  const saveMemo = useCallback(async (memo: string, images: string[]) => {
    setSavingMemo(true);
    await fetch("/api/problem-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, problem_no: pno, sub_no: sno, subsub_no: ssno, memo, images }),
    });
    setSavingMemo(false);
  }, [bookId, pno, sno, ssno]);

  const handleMemoChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNote(prev => ({ ...prev, memo: val }));
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => void saveMemo(val, note.images), 1200);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/problem-notes/upload", { method: "POST", body: form });
    const json = await res.json();
    if (json.url) {
      const newImages = [...note.images, json.url];
      setNote(prev => ({ ...prev, images: newImages }));
      void saveMemo(note.memo, newImages);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    const newImages = note.images.filter((_, i) => i !== idx);
    setNote(prev => ({ ...prev, images: newImages }));
    void saveMemo(note.memo, newImages);
  };

  const navigate = (k: string) => {
    router.push(`/shelf/${bookId}/problem/${k}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#94A3B8" }}>
          読み込み中...
        </div>
      </AppLayout>
    );
  }

  const label = problemLabel(pno, sno, ssno);

  return (
    <AppLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Link href={`/shelf/${bookId}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 700 }}>
            <ArrowLeft size={15} /> 演習シートに戻る
          </Link>
        </div>

        {/* 教材名・問題ラベル */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            {book ? SUBJECT_LABEL[book.subject] ?? book.subject : ""} · {book?.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{label}</h1>

            {/* 問題ジャンプ */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowList(v => !v)} style={jumpBtnStyle}>
                全問題 <ChevronDown size={12} />
              </button>
              {showList && (
                <div style={dropdownStyle}>
                  <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 800, color: "#94A3B8", borderBottom: "1px solid #F1F5F9" }}>問題を選択</div>
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {allKeys.map(k => {
                      const [p, s, ss] = parseKey(k);
                      return (
                        <button
                          key={k}
                          onClick={() => { setShowList(false); navigate(k); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "7px 12px", fontSize: 13, fontWeight: k === key ? 800 : 500,
                            color: k === key ? "var(--accent)" : "#0F172A",
                            background: k === key ? "#EEF4FF" : "transparent",
                            border: "none", cursor: "pointer",
                          }}
                        >
                          {problemLabel(p, s, ss)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 回答履歴 */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}><BookOpen size={13} /> 回答履歴</div>
          <div style={{ display: "flex", gap: 10 }}>
            {slots.map((slot, i) => {
              const r = RESULTS.find(x => x.value === slot.result);
              return (
                <div key={i} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center",
                  border: `1px solid ${r ? r.color + "44" : "#E2E8F0"}`,
                  background: r ? r.bg : "#F8FAFC",
                }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>{i + 1}回目</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: r ? r.color : "#CBD5E1" }}>
                    {r ? r.short : "—"}
                  </div>
                  {slot.recorded_at && (
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                      {new Date(slot.recorded_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* メモ */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={sectionTitleStyle}>メモ</div>
            {savingMemo && <span style={{ fontSize: 11, color: "#94A3B8" }}>保存中...</span>}
          </div>
          <textarea
            value={note.memo}
            onChange={handleMemoChange}
            placeholder="解き方のポイント、ミスの原因、気づきなど..."
            rows={5}
            style={memoStyle}
          />
        </div>

        {/* 写真 */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={sectionTitleStyle}>写真・画像</div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={uploadBtnStyle}>
              <ImagePlus size={13} /> {uploading ? "アップロード中..." : "追加"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
          </div>
          {note.images.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #E2E8F0", borderRadius: 10, padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}
            >
              <ImagePlus size={20} style={{ margin: "0 auto 6px", display: "block", opacity: 0.4 }} />
              タップして画像を追加
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {note.images.map((url, i) => (
                <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "4/3", background: "#F1F5F9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => removeImage(i)}
                    style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(15,23,42,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed #E2E8F0", borderRadius: 8, aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#CBD5E1" }}
              >
                <ImagePlus size={20} />
              </div>
            </div>
          )}
        </div>

        {/* 前後ナビ */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={() => prevKey && navigate(prevKey)}
            disabled={!prevKey}
            style={{ ...navBtnStyle, opacity: prevKey ? 1 : 0.3 }}
          >
            <ArrowLeft size={15} />
            {prevKey ? problemLabel(...parseKey(prevKey)) : "前の問題"}
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => nextKey && navigate(nextKey)}
            disabled={!nextKey}
            style={{ ...navBtnStyle, opacity: nextKey ? 1 : 0.3 }}
          >
            {nextKey ? problemLabel(...parseKey(nextKey)) : "次の問題"}
            <ArrowRight size={15} />
          </button>
        </div>

        {/* 削除ボタン（画像一括） */}
        {note.images.length > 0 && (
          <button
            onClick={() => { setNote(prev => ({ ...prev, images: [] })); void saveMemo(note.memo, []); }}
            style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 16, fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Trash2 size={12} /> 画像をすべて削除
          </button>
        )}

      </div>
    </AppLayout>
  );
}

const sectionStyle: CSSProperties = {
  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
  padding: "14px 16px", marginBottom: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};
const sectionTitleStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 11, fontWeight: 800, color: "#64748B",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10,
};
const memoStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0",
  borderRadius: 10, fontSize: 14, color: "#0F172A", lineHeight: 1.7,
  resize: "vertical", outline: "none", fontFamily: "inherit",
  background: "#FAFBFF", boxSizing: "border-box",
};
const jumpBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 10px", borderRadius: 8, border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const dropdownStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
  boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: 160,
};
const uploadBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const navBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0",
  background: "#fff", color: "#0F172A", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
