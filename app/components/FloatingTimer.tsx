"use client";

import { Fragment, useState, type CSSProperties } from "react";
import { Check, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useTimer } from "./TimerContext";
import { SUBJECT_LABEL } from "@/lib/types";

type ResultVal = "correct" | "partial" | "wrong";
type ProbRow = { id: string; label: string; result: ResultVal };

const RESULTS: { v: ResultVal; label: string; color: string; bg: string; Icon: typeof Check }[] = [
  { v: "correct", label: "◎", color: "#059669", bg: "#ECFDF5", Icon: Check },
  { v: "partial", label: "△", color: "#B45309", bg: "#FFFBEB", Icon: TriangleAlert },
  { v: "wrong",   label: "×", color: "#DC2626", bg: "#FEF2F2", Icon: X },
];

const SUBJECT_OPTIONS = Object.entries(SUBJECT_LABEL);

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

function newRow(): ProbRow {
  return { id: crypto.randomUUID(), label: "", result: "correct" };
}

export default function FloatingTimer() {
  const { showSaveModal, finalMs, dismissModal } = useTimer();

  const [subject, setSubject] = useState("");
  const [material, setMaterial] = useState("");
  const [range, setRange] = useState("");
  const [rows, setRows] = useState<ProbRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const correctCount = rows.filter(r => r.result === "correct").length;
    const res = await fetch("/api/exercise-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        subject,
        material,
        range,
        question_count: rows.length,
        correct_count: correctCount,
        duration: Math.max(1, Math.round(finalMs / 60000)),
        needs_review: rows.some(r => r.result === "partial" || r.result === "wrong"),
      }),
    });
    const json = await res.json();
    if (json.id && rows.some(r => r.label || r.result !== "correct")) {
      await Promise.all(
        rows.filter(r => r.label || r.result !== "correct").map(r =>
          fetch(`/api/exercise-records/${json.id}/problems`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem_label: r.label, result: r.result, needs_review: r.result !== "correct", reason: "", memo: "" }),
          })
        )
      );
    }
    setSaving(false);
    setSubject(""); setMaterial(""); setRange("");
    setRows([newRow()]);
    dismissModal();
  };

  const handleDiscard = () => {
    setSubject(""); setMaterial(""); setRange("");
    setRows([newRow()]);
    dismissModal();
  };

  const updateRow = (id: string, patch: Partial<ProbRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const addRow = () => setRows(prev => [...prev, newRow()]);
  const removeRow = (id: string) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  if (!showSaveModal) return null;

  return (
    <>
      {/* 記録モーダル */}
      {showSaveModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) handleDiscard(); }}>
          <div style={modalStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {formatTime(finalMs)} の記録
                </p>
                <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, color: "#0F172A" }}>何を勉強しましたか？</h2>
              </div>
              <button onClick={handleDiscard} style={closeBtnStyle}><X size={16} /></button>
            </div>

            {/* 基本情報 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <label style={labelStyle}>
                <span style={labelTextStyle}>教科</span>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle}>
                  <option value="">— 選択 —</option>
                  {SUBJECT_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>教材名</span>
                <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="例: 青チャート" style={inputStyle} autoFocus />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={labelTextStyle}>範囲（任意）</span>
                <input value={range} onChange={e => setRange(e.target.value)} placeholder="例: p.120-130 / 第3章" style={inputStyle} />
              </label>
            </div>

            {/* 問題テーブル */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                問題の記録（任意）
              </div>
              <div style={probTableStyle}>
                {/* ヘッダー */}
                <div style={probTheadStyle}>
                  <div style={{ ...probThStyle, flex: 1 }}>問題番号</div>
                  <div style={{ ...probThStyle, width: 84 }}>結果</div>
                  <div style={{ ...probThStyle, width: 28, border: "none" }} />
                </div>
                {/* 行 */}
                {rows.map((row, idx) => (
                  <Fragment key={row.id}>
                    <div style={probRowStyle}>
                      <div style={{ ...probTdStyle, flex: 1 }}>
                        <input
                          value={row.label}
                          onChange={e => updateRow(row.id, { label: e.target.value })}
                          placeholder={`${idx + 1}`}
                          style={cellInputStyle}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRow(); } }}
                        />
                      </div>
                      <div style={{ ...probTdStyle, width: 84, gap: 3 }}>
                        {RESULTS.map(r => (
                          <button
                            key={r.v}
                            onClick={() => updateRow(row.id, { result: r.v })}
                            style={{
                              padding: "2px 6px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 900,
                              border: `1px solid ${row.result === r.v ? r.color : "#E2E8F0"}`,
                              background: row.result === r.v ? r.bg : "#fff",
                              color: row.result === r.v ? r.color : "#CBD5E1",
                            }}
                          >{r.label}</button>
                        ))}
                      </div>
                      <div style={{ ...probTdStyle, width: 28, border: "none", justifyContent: "center" }}>
                        <button onClick={() => removeRow(row.id)} style={deleteBtnStyle}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
              <button onClick={addRow} style={addRowBtnStyle}>
                <Plus size={11} /> 行を追加　<span style={{ fontSize: 10, color: "#94A3B8" }}>Enter でも追加</span>
              </button>
            </div>

            {/* フッター */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={handleDiscard} style={ghostBtnStyle}>破棄</button>
              <button onClick={() => void handleSave()} disabled={saving} style={saveBtnStyle}>
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0 0" };
const modalStyle: CSSProperties = { width: "100%", maxWidth: 520, background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(15,23,42,0.18)" };
const closeBtnStyle: CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 };

const labelStyle: CSSProperties = { display: "grid", gap: 4 };
const labelTextStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748B" };
const inputStyle: CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#0F172A", outline: "none", background: "#fff", boxSizing: "border-box" };

const probTableStyle: CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" };
const probTheadStyle: CSSProperties = { display: "flex", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" };
const probThStyle: CSSProperties = { padding: "5px 8px", fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #E2E8F0", display: "flex", alignItems: "center", flexShrink: 0 };
const probRowStyle: CSSProperties = { display: "flex", borderBottom: "1px solid #F1F5F9", background: "#fff" };
const probTdStyle: CSSProperties = { padding: "2px 4px", borderRight: "1px solid #F1F5F9", display: "flex", alignItems: "center", flexShrink: 0, minHeight: 30 };
const cellInputStyle: CSSProperties = { width: "100%", padding: "3px 4px", border: "1px solid transparent", borderRadius: 4, background: "transparent", fontSize: 12, color: "#0F172A", outline: "none", fontFamily: "inherit" };
const deleteBtnStyle: CSSProperties = { width: 20, height: 20, borderRadius: 4, border: "1px solid #E2E8F0", background: "#fff", color: "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const addRowBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer" };

const saveBtnStyle: CSSProperties = { padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const ghostBtnStyle: CSSProperties = { padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer" };
