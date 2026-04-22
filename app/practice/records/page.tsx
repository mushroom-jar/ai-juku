"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import { SUBJECT_LABEL } from "@/lib/types";
import { ChevronDown, ChevronRight, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";

type ResultVal = "correct" | "partial" | "wrong";

const RESULTS: { v: ResultVal; label: string; color: string; bg: string }[] = [
  { v: "correct", label: "◎", color: "#059669", bg: "#ECFDF5" },
  { v: "partial", label: "△", color: "#B45309", bg: "#FFFBEB" },
  { v: "wrong",   label: "×", color: "#DC2626", bg: "#FEF2F2" },
];

type ExRec = {
  id: string;
  date: string;
  subject: string;
  material: string;
  range: string;
  question_count: number;
  correct_count: number;
  duration: number;
  needs_review: boolean;
};

type ProbRec = {
  id: string;
  exercise_record_id: string;
  problem_label: string;
  result: ResultVal;
  needs_review: boolean;
  reason: string;
  memo: string;
};

type BookSession = {
  book_id: string;
  book_title: string;
  subject: string;
  date: string;
  total: number;
  correct: number;
};

const SUBJECT_OPTIONS = Object.entries(SUBJECT_LABEL);
const todayStr = () => new Date().toISOString().slice(0, 10);

function emptyExRec(): Omit<ExRec, "id"> {
  return { date: todayStr(), subject: "", material: "", range: "", question_count: 0, correct_count: 0, duration: 0, needs_review: false };
}

function accuracy(rec: ExRec | Omit<ExRec, "id">): number | null {
  if (!("question_count" in rec) || rec.question_count <= 0) return null;
  return rec.correct_count / rec.question_count;
}

function autoReview(rec: ExRec | Omit<ExRec, "id">): boolean {
  const acc = accuracy(rec);
  return acc !== null && acc < 0.6;
}

export default function ExerciseRecordsPage() {
  const [tab, setTab] = useState<"timer" | "book">("timer");
  const [records, setRecords] = useState<ExRec[]>([]);
  const [bookSessions, setBookSessions] = useState<BookSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, ProbRec[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<ExRec>>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [newRow, setNewRow] = useState<Omit<ExRec, "id"> | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [sortCol, setSortCol] = useState<keyof ExRec>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterReview, setFilterReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [recRes, bsRes] = await Promise.all([
      fetch("/api/exercise-records"),
      fetch("/api/exercise-records/book-sessions"),
    ]);
    const [recJson, bsJson] = await Promise.all([recRes.json(), bsRes.json()]);
    setRecords(recJson.records ?? []);
    setBookSessions(bsJson.sessions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadProblems = useCallback(async (id: string) => {
    const res = await fetch(`/api/exercise-records/${id}/problems`);
    const json = await res.json();
    setProblems(prev => ({ ...prev, [id]: json.problems ?? [] }));
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!problems[id]) await loadProblems(id);
  };

  const getDraft = (rec: ExRec): ExRec => ({ ...rec, ...drafts[rec.id] });
  const isDirty = (id: string) => !!drafts[id] && Object.keys(drafts[id]).length > 0;

  const updateDraft = (id: string, patch: Partial<ExRec>) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const saveRecord = async (rec: ExRec) => {
    const merged = getDraft(rec);
    const payload = { ...merged, needs_review: merged.needs_review || autoReview(merged) };
    setSaving(prev => new Set(prev).add(rec.id));
    await fetch(`/api/exercise-records/${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setRecords(prev => prev.map(r => r.id === rec.id ? payload : r));
    setDrafts(prev => { const n = { ...prev }; delete n[rec.id]; return n; });
    setSaving(prev => { const n = new Set(prev); n.delete(rec.id); return n; });
  };

  const deleteRecord = async (id: string) => {
    await fetch(`/api/exercise-records/${id}`, { method: "DELETE" });
    setRecords(prev => prev.filter(r => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const commitNew = async () => {
    if (!newRow) return;
    setAddingNew(true);
    const payload = { ...newRow, needs_review: newRow.needs_review || autoReview(newRow) };
    const res = await fetch("/api/exercise-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setRecords(prev => [json, ...prev]);
    setNewRow(null);
    setAddingNew(false);
  };

  const addProblem = async (exId: string) => {
    const res = await fetch(`/api/exercise-records/${exId}/problems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise_record_id: exId, problem_label: "", result: "correct", needs_review: false, reason: "", memo: "" }),
    });
    const json = await res.json();
    setProblems(prev => ({ ...prev, [exId]: [...(prev[exId] ?? []), json] }));
  };

  const updateProblem = (exId: string, updated: ProbRec) => {
    const needsReview = updated.result === "partial" || updated.result === "wrong";
    const p = { ...updated, needs_review: updated.needs_review || needsReview };
    setProblems(prev => ({ ...prev, [exId]: (prev[exId] ?? []).map(x => x.id === p.id ? p : x) }));
    void fetch(`/api/exercise-records/${exId}/problems/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  };

  const deleteProblem = async (exId: string, probId: string) => {
    await fetch(`/api/exercise-records/${exId}/problems/${probId}`, { method: "DELETE" });
    setProblems(prev => ({ ...prev, [exId]: (prev[exId] ?? []).filter(p => p.id !== probId) }));
  };

  const toggleSort = (col: keyof ExRec) => {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(false); }
  };

  const sortedFiltered = useMemo(() => {
    let list = [...records];
    if (filterSubject) list = list.filter(r => r.subject === filterSubject);
    if (filterReview) list = list.filter(r => r.needs_review);
    list.sort((a, b) => {
      const av = String(a[sortCol]), bv = String(b[sortCol]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [records, filterSubject, filterReview, sortCol, sortAsc]);

  const SortTh = ({ col, label, width }: { col: keyof ExRec; label: string; width?: number }) => (
    <div
      onClick={() => toggleSort(col)}
      style={{ ...thStyle, width, cursor: "pointer", userSelect: "none", gap: 3 }}
    >
      {label}
      {sortCol === col && <span style={{ fontSize: 9 }}>{sortAsc ? "▲" : "▼"}</span>}
    </div>
  );

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Practice</p>
              <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: "#0F172A" }}>演習記録</h1>
            </div>
            {tab === "timer" && (
              <>
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={filterSelectStyle}>
                  <option value="">すべての教科</option>
                  {SUBJECT_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#64748B", cursor: "pointer" }}>
                  <input type="checkbox" checked={filterReview} onChange={e => setFilterReview(e.target.checked)} />
                  復習のみ
                </label>
                <button onClick={() => setNewRow(emptyExRec())} style={addBtnStyle} disabled={!!newRow}>
                  <Plus size={14} /> 新規追加
                </button>
              </>
            )}
          </div>
          {/* タブ */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setTab("timer")} style={tabBtnStyle(tab === "timer")}>タイマー記録</button>
            <button onClick={() => setTab("book")} style={tabBtnStyle(tab === "book")}>教材記録</button>
          </div>
        </div>

        {/* 教材記録タブ */}
        {tab === "book" && (
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", background: "#fff", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>読み込み中...</div>
            ) : bookSessions.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                本棚の「演習シートを開く」から問題を記録すると、ここに表示されます。
              </div>
            ) : (
              <>
                <div style={{ display: "flex", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["日付", "教材", "教科", "問題数", "正答率", ""].map((h, i) => (
                    <div key={i} style={{ ...thStyle, width: i === 0 ? 90 : i === 1 ? 200 : i === 2 ? 72 : i === 3 ? 60 : i === 4 ? 60 : undefined, flex: i === 5 ? 1 : undefined }}>{h}</div>
                  ))}
                </div>
                {bookSessions.map((s, i) => {
                  const acc = s.total > 0 ? s.correct / s.total : null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", minHeight: 30, borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ ...tdStyle, width: 90 }}><span style={{ fontSize: 12, color: "#475569", padding: "0 4px" }}>{s.date}</span></div>
                      <div style={{ ...tdStyle, width: 200 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{s.book_title}</span></div>
                      <div style={{ ...tdStyle, width: 72 }}><span style={{ fontSize: 11, color: "#64748B", padding: "0 4px" }}>{SUBJECT_LABEL[s.subject] ?? s.subject}</span></div>
                      <div style={{ ...tdStyle, width: 60, justifyContent: "center" }}><span style={{ fontSize: 12, color: "#475569" }}>{s.total}</span></div>
                      <div style={{ ...tdStyle, width: 60, justifyContent: "center" }}><AccBadge val={acc} /></div>
                      <div style={{ ...tdStyle, flex: 1, border: "none", justifyContent: "flex-end", paddingRight: 8 }}>
                        <Link href={`/shelf/${s.book_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                          <ExternalLink size={11} /> シートを開く
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* タイマー記録テーブル */}
        {tab === "timer" && <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", background: "#fff" }}>
          <div style={{ minWidth: 700 }}>
            {/* ヘッダー行 */}
            <div style={theadRowStyle}>
              <div style={{ ...thStyle, width: 24 }} />
              <SortTh col="date" label="日付" width={82} />
              <SortTh col="subject" label="教科" width={64} />
              <SortTh col="material" label="教材" width={150} />
              <div style={{ ...thStyle, width: 90 }}>範囲</div>
              <SortTh col="question_count" label="問" width={42} />
              <SortTh col="correct_count" label="正" width={42} />
              <div style={{ ...thStyle, width: 48 }}>正答率</div>
              <SortTh col="duration" label="分" width={42} />
              <SortTh col="needs_review" label="復習" width={40} />
              <div style={{ ...thStyle, width: 52, border: "none" }} />
            </div>

            {/* 新規追加行 */}
            {newRow && (
              <div style={{ borderBottom: "2px solid #BFDBFE", background: "#EFF6FF" }}>
                <div style={dataRowStyle}>
                  <div style={{ ...tdStyle, width: 24 }} />
                  <div style={{ ...tdStyle, width: 82 }}>
                    <input type="date" value={newRow.date} onChange={e => setNewRow(r => r && ({ ...r, date: e.target.value }))} style={cellInputStyle} />
                  </div>
                  <div style={{ ...tdStyle, width: 64 }}>
                    <select value={newRow.subject} onChange={e => setNewRow(r => r && ({ ...r, subject: e.target.value }))} style={cellInputStyle}>
                      <option value="">—</option>
                      {SUBJECT_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ ...tdStyle, width: 150 }}>
                    <input value={newRow.material} onChange={e => setNewRow(r => r && ({ ...r, material: e.target.value }))} placeholder="教材名" style={cellInputStyle} autoFocus />
                  </div>
                  <div style={{ ...tdStyle, width: 90 }}>
                    <input value={newRow.range} onChange={e => setNewRow(r => r && ({ ...r, range: e.target.value }))} placeholder="範囲" style={cellInputStyle} />
                  </div>
                  <div style={{ ...tdStyle, width: 42 }}>
                    <input type="number" min={0} value={newRow.question_count} onChange={e => setNewRow(r => r && ({ ...r, question_count: Number(e.target.value) || 0 }))} style={{ ...cellInputStyle, textAlign: "center" }} />
                  </div>
                  <div style={{ ...tdStyle, width: 42 }}>
                    <input type="number" min={0} value={newRow.correct_count} onChange={e => setNewRow(r => r && ({ ...r, correct_count: Number(e.target.value) || 0 }))} style={{ ...cellInputStyle, textAlign: "center" }} />
                  </div>
                  <div style={{ ...tdStyle, width: 48, justifyContent: "center" }}>
                    <AccBadge val={accuracy(newRow)} />
                  </div>
                  <div style={{ ...tdStyle, width: 42 }}>
                    <input type="number" min={0} value={newRow.duration} onChange={e => setNewRow(r => r && ({ ...r, duration: Number(e.target.value) || 0 }))} style={{ ...cellInputStyle, textAlign: "center" }} />
                  </div>
                  <div style={{ ...tdStyle, width: 40, justifyContent: "center" }}>
                    <input type="checkbox" checked={newRow.needs_review || autoReview(newRow)} onChange={e => setNewRow(r => r && ({ ...r, needs_review: e.target.checked }))} />
                  </div>
                  <div style={{ ...tdStyle, width: 52, border: "none", gap: 4 }}>
                    <button onClick={() => void commitNew()} disabled={addingNew} style={saveBtnStyle}>
                      <Save size={11} /> {addingNew ? "…" : "保存"}
                    </button>
                    <button onClick={() => setNewRow(null)} style={deleteBtnStyle}><Trash2 size={11} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* データ行 */}
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>読み込み中...</div>
            ) : sortedFiltered.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                記録がありません。「新規追加」から記録を始めましょう。
              </div>
            ) : sortedFiltered.map(rec => {
              const d = getDraft(rec);
              const dirty = isDirty(rec.id);
              const expanded = expandedId === rec.id;
              const acc = accuracy(d);
              return (
                <div key={rec.id} style={{ borderBottom: "1px solid #F1F5F9", background: expanded ? "#FAFBFF" : "#fff" }}>
                  <div style={dataRowStyle}>
                    <div style={{ ...tdStyle, width: 24, justifyContent: "center", cursor: "pointer" }} onClick={() => void toggleExpand(rec.id)}>
                      {expanded ? <ChevronDown size={12} color="#64748B" /> : <ChevronRight size={12} color="#CBD5E1" />}
                    </div>
                    <div style={{ ...tdStyle, width: 82 }}>
                      <input type="date" value={d.date} onChange={e => updateDraft(rec.id, { date: e.target.value })} style={cellInputStyle} />
                    </div>
                    <div style={{ ...tdStyle, width: 64 }}>
                      <select value={d.subject} onChange={e => updateDraft(rec.id, { subject: e.target.value })} style={cellInputStyle}>
                        <option value="">—</option>
                        {SUBJECT_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div style={{ ...tdStyle, width: 150 }}>
                      <input value={d.material} onChange={e => updateDraft(rec.id, { material: e.target.value })} style={cellInputStyle} />
                    </div>
                    <div style={{ ...tdStyle, width: 90 }}>
                      <input value={d.range} onChange={e => updateDraft(rec.id, { range: e.target.value })} style={cellInputStyle} />
                    </div>
                    <div style={{ ...tdStyle, width: 42 }}>
                      <input type="number" min={0} value={d.question_count} onChange={e => updateDraft(rec.id, { question_count: Number(e.target.value) || 0 })} style={{ ...cellInputStyle, textAlign: "center" }} />
                    </div>
                    <div style={{ ...tdStyle, width: 42 }}>
                      <input type="number" min={0} value={d.correct_count} onChange={e => updateDraft(rec.id, { correct_count: Number(e.target.value) || 0 })} style={{ ...cellInputStyle, textAlign: "center" }} />
                    </div>
                    <div style={{ ...tdStyle, width: 48, justifyContent: "center" }}>
                      <AccBadge val={acc} />
                    </div>
                    <div style={{ ...tdStyle, width: 42 }}>
                      <input type="number" min={0} value={d.duration} onChange={e => updateDraft(rec.id, { duration: Number(e.target.value) || 0 })} style={{ ...cellInputStyle, textAlign: "center" }} />
                    </div>
                    <div style={{ ...tdStyle, width: 40, justifyContent: "center" }}>
                      <input type="checkbox" checked={d.needs_review || autoReview(d)} onChange={e => updateDraft(rec.id, { needs_review: e.target.checked })} />
                    </div>
                    <div style={{ ...tdStyle, width: 52, border: "none", gap: 4, justifyContent: "flex-end" }}>
                      {dirty && (
                        <button onClick={() => void saveRecord(rec)} disabled={saving.has(rec.id)} style={saveBtnStyle}>
                          <Save size={11} /> {saving.has(rec.id) ? "…" : "保存"}
                        </button>
                      )}
                      <button onClick={() => void deleteRecord(rec.id)} style={deleteBtnStyle}><Trash2 size={11} /></button>
                    </div>
                  </div>

                  {/* 問題詳細 */}
                  {expanded && (
                    <div style={{ padding: "6px 12px 10px 32px", borderTop: "1px solid #E8EFFE", background: "#F8FAFF" }}>
                      {(problems[rec.id] ?? []).length > 0 && (
                        <div style={{ marginBottom: 6, border: "1px solid #E8EFFE", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ display: "flex", background: "#EEF2F6" }}>
                            {(["問題", "結果", "復習", "ミス理由", "メモ", ""] as const).map((h, i) => (
                              <div key={i} style={{ ...probThStyle, width: i === 0 ? 80 : i === 1 ? 72 : i === 2 ? 40 : i === 5 ? 30 : undefined, flex: i === 3 || i === 4 ? 1 : undefined }}>{h}</div>
                            ))}
                          </div>
                          {(problems[rec.id] ?? []).map(prob => (
                            <div key={prob.id} style={{ display: "flex", borderBottom: "1px solid #EEF2F6", background: "#fff" }}>
                              <div style={{ ...probTdStyle, width: 80 }}>
                                <input value={prob.problem_label} onChange={e => updateProblem(rec.id, { ...prob, problem_label: e.target.value })} placeholder="1-2" style={cellInputStyle} />
                              </div>
                              <div style={{ ...probTdStyle, width: 72, gap: 2 }}>
                                {RESULTS.map(r => (
                                  <button key={r.v} onClick={() => updateProblem(rec.id, { ...prob, result: r.v })}
                                    style={{ padding: "2px 5px", borderRadius: 5, border: `1px solid ${prob.result === r.v ? r.color : "#E2E8F0"}`, background: prob.result === r.v ? r.bg : "#fff", color: prob.result === r.v ? r.color : "#CBD5E1", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                              <div style={{ ...probTdStyle, width: 40, justifyContent: "center" }}>
                                <input type="checkbox" checked={prob.needs_review || prob.result === "partial" || prob.result === "wrong"} onChange={e => updateProblem(rec.id, { ...prob, needs_review: e.target.checked })} />
                              </div>
                              <div style={{ ...probTdStyle, flex: 1 }}>
                                <input value={prob.reason} onChange={e => updateProblem(rec.id, { ...prob, reason: e.target.value })} placeholder="ミス理由" style={cellInputStyle} />
                              </div>
                              <div style={{ ...probTdStyle, flex: 1 }}>
                                <input value={prob.memo} onChange={e => updateProblem(rec.id, { ...prob, memo: e.target.value })} placeholder="メモ" style={cellInputStyle} />
                              </div>
                              <div style={{ ...probTdStyle, width: 30, border: "none", justifyContent: "center" }}>
                                <button onClick={() => void deleteProblem(rec.id, prob.id)} style={deleteBtnStyle}><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => void addProblem(rec.id)} style={{ ...addBtnStyle, fontSize: 11, padding: "5px 10px" }}>
                        <Plus size={11} /> 問題を追加
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>}

      </div>
    </AppLayout>
  );
}

function AccBadge({ val }: { val: number | null }) {
  if (val === null) return <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>;
  const pct = Math.round(val * 100);
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#B45309" : "#DC2626";
  return <span style={{ fontSize: 12, fontWeight: 800, color }}>{pct}%</span>;
}

const theadRowStyle: CSSProperties = { display: "flex", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" };
const dataRowStyle: CSSProperties = { display: "flex", alignItems: "center", minHeight: 30 };
const thStyle: CSSProperties = { padding: "5px 4px", fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #E8ECF0", display: "flex", alignItems: "center", flexShrink: 0 };
const tdStyle: CSSProperties = { padding: "1px 2px", borderRight: "1px solid #F1F5F9", display: "flex", alignItems: "center", flexShrink: 0, minHeight: 30 };
const cellInputStyle: CSSProperties = { width: "100%", padding: "3px 4px", border: "1px solid transparent", borderRadius: 4, background: "transparent", fontSize: 12, color: "#0F172A", outline: "none", fontFamily: "inherit" };
const probThStyle: CSSProperties = { padding: "4px 6px", fontSize: 10, fontWeight: 800, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: "1px solid #DDE4EE", display: "flex", alignItems: "center", flexShrink: 0 };
const probTdStyle: CSSProperties = { padding: "2px 4px", borderRight: "1px solid #EEF2F6", display: "flex", alignItems: "center", flexShrink: 0, minHeight: 28, gap: 2 };
const tabBtnStyle = (active: boolean): CSSProperties => ({
  padding: "6px 14px", borderRadius: 8,
  border: active ? "1px solid rgba(49,87,183,0.3)" : "1px solid #E2E8F0",
  background: active ? "#EEF4FF" : "#fff",
  color: active ? "var(--accent)" : "#64748B",
  fontSize: 12, fontWeight: 800, cursor: "pointer",
});
const filterSelectStyle: CSSProperties = { padding: "6px 8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, color: "#0F172A", outline: "none" };
const addBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const saveBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 5, border: "none", background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const deleteBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, border: "1px solid #E2E8F0", background: "#fff", color: "#94A3B8", cursor: "pointer", padding: 0, flexShrink: 0 };
