"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import AppLayout from "@/app/components/AppLayout";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2, X } from "lucide-react";

type PersonalEvent = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  notes: string | null;
};

type EventsResponse = {
  events: PersonalEvent[];
  studyMinutesByDate: Record<string, number>;
};

const EVENT_TYPES = [
  { value: "club", label: "部活", color: "#F97316", bg: "#FFF7ED" },
  { value: "test", label: "テスト", color: "#DC2626", bg: "#FEF2F2" },
  { value: "lesson", label: "授業", color: "#2563EB", bg: "#EFF6FF" },
  { value: "free", label: "自由", color: "#16A34A", bg: "#F0FDF4" },
  { value: "other", label: "その他", color: "#6B7280", bg: "#F9FAFB" },
] as const;

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function typeConfig(type: string) {
  return EVENT_TYPES.find((item) => item.value === type) ?? EVENT_TYPES[4];
}

function formatTime(value: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatStudyMinutes(totalMinutes: number) {
  if (!totalMinutes || totalMinutes <= 0) return "0分";
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}

export default function EventsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [studyMinutesByDate, setStudyMinutesByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("other");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      setLoading(true);
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const res = await fetch(`/api/events?from=${from}&to=${to}`, { cache: "no-store" });
      const data: EventsResponse = await res.json();
      if (cancelled) return;
      setEvents(data.events ?? []);
      setStudyMinutesByDate(data.studyMinutesByDate ?? {});
      setLoading(false);
    }

    void loadMonth();

    return () => {
      cancelled = true;
    };
  }, [month, year]);

  async function loadMonth(targetYear = year, targetMonth = month) {
    const from = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const to = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const res = await fetch(`/api/events?from=${from}&to=${to}`, { cache: "no-store" });
    const data: EventsResponse = await res.json();
    setEvents(data.events ?? []);
    setStudyMinutesByDate(data.studyMinutesByDate ?? {});
    setLoading(false);
  }

  function prevMonth() {
    if (month === 0) {
      setYear((value) => value - 1);
      setMonth(11);
    } else {
      setMonth((value) => value - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((value) => value + 1);
      setMonth(0);
    } else {
      setMonth((value) => value + 1);
    }
  }

  function openForm(dateStr: string) {
    setFormDate(dateStr);
    setFormTitle("");
    setFormType("other");
    setFormStart("");
    setFormEnd("");
    setFormNotes("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle.trim(),
        date: formDate,
        start_time: formStart || null,
        end_time: formEnd || null,
        event_type: formType,
        notes: formNotes || null,
      }),
    });
    setSaving(false);
    setShowForm(false);
    await loadMonth();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const eventsMap = new Map<string, PersonalEvent[]>();
  for (const event of events) {
    if (!eventsMap.has(event.date)) eventsMap.set(event.date, []);
    eventsMap.get(event.date)!.push(event);
  }

  const totalStudyMinutes = Object.values(studyMinutesByDate).reduce((sum, value) => sum + value, 0);

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>
          <section style={heroStyle}>
            <div>
              <p style={eyebrowStyle}>Calendar</p>
              <h1 style={titleStyle}>予定と勉強時間をまとめて見る</h1>
              <p style={subtitleStyle}>
                毎日の予定に加えて、その日にどれだけ勉強できたかも同じカレンダーで確認できます。
              </p>
            </div>
            <button onClick={() => openForm(todayStr)} style={primaryButtonStyle}>
              <Plus size={16} />
              予定を追加
            </button>
          </section>

          <section style={overviewGridStyle}>
            <OverviewCard label="今月の勉強時間" value={formatStudyMinutes(totalStudyMinutes)} helper="この月に記録した演習時間" />
            <OverviewCard
              label="勉強した日"
              value={`${Object.values(studyMinutesByDate).filter((value) => value > 0).length}日`}
              helper="勉強時間が記録された日数"
            />
          </section>

          <section style={calendarCardStyle}>
            <div style={calendarHeaderStyle}>
              <button onClick={prevMonth} style={navButtonStyle}>
                <ChevronLeft size={18} />
              </button>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0F172A" }}>{year}年 {month + 1}月</h2>
              <button onClick={nextMonth} style={navButtonStyle}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div style={legendStyle}>
              {EVENT_TYPES.map((type) => (
                <span key={type.value} style={{ ...legendChipStyle, background: type.bg, color: type.color }}>
                  {type.label}
                </span>
              ))}
              <span style={{ ...legendChipStyle, background: "#EEF4FF", color: "#3157B7" }}>勉強時間</span>
            </div>

            <div style={dayHeaderGridStyle}>
              {DAY_LABELS.map((label) => (
                <div key={label} style={dayHeaderCellStyle}>
                  {label}
                </div>
              ))}
            </div>

            <div style={calendarGridStyle}>
              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`empty-${index}`} style={emptyCellStyle} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsMap.get(dateStr) ?? [];
                const studyMinutes = studyMinutesByDate[dateStr] ?? 0;
                const isToday = dateStr === todayStr;

                return (
                  <button key={day} onClick={() => openForm(dateStr)} style={dayCellStyle(isToday)}>
                    <span style={dayNumberStyle(isToday)}>{day}</span>

                    {studyMinutes > 0 ? (
                      <div style={studyBadgeStyle}>
                        <Clock size={11} />
                        {formatStudyMinutes(studyMinutes)}
                      </div>
                    ) : null}

                    <div style={{ display: "grid", gap: 3, marginTop: 6 }}>
                      {dayEvents.slice(0, 2).map((event) => {
                        const config = typeConfig(event.event_type);
                        return (
                          <span key={event.id} style={{ ...miniEventStyle, background: config.bg, color: config.color }}>
                            {event.title}
                          </span>
                        );
                      })}
                      {dayEvents.length > 2 ? <span style={moreStyle}>+{dayEvents.length - 2}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={listCardStyle}>
            <div style={sectionHeadStyle}>
              <div>
                <h2 style={sectionTitleStyle}>{month + 1}月の予定一覧</h2>
                <p style={sectionDescStyle}>その日の予定と勉強時間を時系列で見返せます。</p>
              </div>
            </div>

            {!loading && (events.length > 0 || Object.keys(studyMinutesByDate).length > 0) ? (
              <div style={{ display: "grid", gap: 10 }}>
                {Array.from(new Set([...events.map((event) => event.date), ...Object.keys(studyMinutesByDate)])).sort().map((date) => {
                  const dayEvents = eventsMap.get(date) ?? [];
                  const studyMinutes = studyMinutesByDate[date] ?? 0;
                  const day = new Date(`${date}T00:00:00`);

                  return (
                    <article key={date} style={daySummaryStyle}>
                      <div style={dateColStyle}>
                        <div style={dateNumStyle}>{day.getDate()}</div>
                        <div style={dateDayStyle}>{DAY_LABELS[day.getDay()]}</div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 10 }}>
                        {studyMinutes > 0 ? (
                          <div style={studySummaryStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Clock size={14} color="#3157B7" />
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>勉強時間</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#3157B7" }}>{formatStudyMinutes(studyMinutes)}</span>
                          </div>
                        ) : null}

                        {dayEvents.length > 0 ? (
                          dayEvents.map((event) => {
                            const config = typeConfig(event.event_type);
                            return (
                              <div key={event.id} style={eventRowStyle}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                    <span style={{ ...legendChipStyle, background: config.bg, color: config.color }}>{config.label}</span>
                                    {(event.start_time || event.end_time) && (
                                      <span style={timeChipStyle}>
                                        <Clock size={12} />
                                        {formatTime(event.start_time)}
                                        {event.end_time ? ` - ${formatTime(event.end_time)}` : ""}
                                      </span>
                                    )}
                                  </div>
                                  <h3 style={eventTitleStyle}>{event.title}</h3>
                                  {event.notes ? <p style={eventNotesStyle}>{event.notes}</p> : null}
                                </div>

                                <button onClick={() => void handleDelete(event.id)} style={deleteButtonStyle}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div style={emptyLineStyle}>予定はありません</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : loading ? (
              <div style={emptyStyle}>予定を読み込み中です...</div>
            ) : (
              <div style={emptyStyle}>この月の予定や勉強時間はまだありません。</div>
            )}
          </section>
        </main>
      </div>

      {showForm ? (
        <div style={modalBackdropStyle} onClick={() => setShowForm(false)}>
          <section style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeadStyle}>
              <div>
                <h2 style={sectionTitleStyle}>予定を追加</h2>
                <p style={sectionDescStyle}>日付、種類、時間をまとめて入れられます。</p>
              </div>
              <button onClick={() => setShowForm(false)} style={closeButtonStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <Field label="日付">
                <input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} style={inputStyle} />
              </Field>

              <Field label="タイトル">
                <input value={formTitle} onChange={(event) => setFormTitle(event.target.value)} style={inputStyle} placeholder="学校行事やテスト" autoFocus />
              </Field>

              <Field label="種類">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EVENT_TYPES.map((type) => (
                    <button key={type.value} onClick={() => setFormType(type.value)} style={typeButtonStyle(formType === type.value, type.color, type.bg)}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="開始">
                  <input type="time" value={formStart} onChange={(event) => setFormStart(event.target.value)} style={inputStyle} />
                </Field>
                <Field label="終了">
                  <input type="time" value={formEnd} onChange={(event) => setFormEnd(event.target.value)} style={inputStyle} />
                </Field>
              </div>

              <Field label="メモ">
                <input value={formNotes} onChange={(event) => setFormNotes(event.target.value)} style={inputStyle} placeholder="補足があれば" />
              </Field>

              <button onClick={() => void handleSave()} disabled={!formTitle.trim() || saving} style={saveButtonStyle(!formTitle.trim() || saving)}>
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#344054" }}>{label}</span>
      {children}
    </label>
  );
}

function OverviewCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div style={overviewCardStyle}>
      <div style={overviewLabelStyle}>{label}</div>
      <div style={overviewValueStyle}>{value}</div>
      <div style={overviewHelperStyle}>{helper}</div>
    </div>
  );
}

const pageStyle: CSSProperties = { minHeight: "100dvh", padding: "18px 16px 96px" };
const mainStyle: CSSProperties = { maxWidth: 960, margin: "0 auto", display: "grid", gap: 16 };
const heroStyle: CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};
const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" };
const titleStyle: CSSProperties = { margin: "8px 0 0", fontSize: 28, lineHeight: 1.15, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "#64748B", maxWidth: 620 };
const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "none",
  borderRadius: 16,
  background: "linear-gradient(135deg, #3555C6, #5E78DA)",
  color: "#FFFFFF",
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
const overviewGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
const overviewCardStyle: CSSProperties = {
  borderRadius: 20,
  padding: 18,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
};
const overviewLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#64748B" };
const overviewValueStyle: CSSProperties = { marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0F172A" };
const overviewHelperStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#94A3B8", lineHeight: 1.6 };
const calendarCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
};
const calendarHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 };
const navButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "#F8FAFC",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#475467",
};
const legendStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 };
const legendChipStyle: CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800 };
const dayHeaderGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 };
const dayHeaderCellStyle: CSSProperties = { textAlign: "center", fontSize: 12, fontWeight: 700, color: "#64748B", paddingBottom: 6 };
const calendarGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 };
const emptyCellStyle: CSSProperties = { minHeight: 126 };
const dayCellStyle = (isToday: boolean): CSSProperties => ({
  minHeight: 126,
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.14)",
  background: isToday ? "linear-gradient(180deg, #EEF4FF 0%, #FFFFFF 100%)" : "#FFFFFF",
  padding: 10,
  textAlign: "left",
  cursor: "pointer",
});
const dayNumberStyle = (isToday: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: isToday ? "#3157B7" : "#F8FAFC",
  color: isToday ? "#FFFFFF" : "#0F172A",
  fontSize: 12,
  fontWeight: 800,
});
const studyBadgeStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 999,
  padding: "4px 8px",
  background: "#EEF4FF",
  color: "#3157B7",
  fontSize: 11,
  fontWeight: 800,
};
const miniEventStyle: CSSProperties = {
  display: "block",
  borderRadius: 8,
  padding: "4px 6px",
  fontSize: 10,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const moreStyle: CSSProperties = { fontSize: 10, color: "#64748B", fontWeight: 700 };
const listCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
};
const sectionHeadStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 18, color: "#0F172A" };
const sectionDescStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" };
const daySummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
  borderRadius: 18,
  padding: 14,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
};
const dateColStyle: CSSProperties = { width: 48, flexShrink: 0, textAlign: "center" };
const dateNumStyle: CSSProperties = { fontSize: 18, fontWeight: 900, color: "#0F172A", lineHeight: 1 };
const dateDayStyle: CSSProperties = { marginTop: 4, fontSize: 11, fontWeight: 700, color: "#64748B" };
const studySummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderRadius: 14,
  padding: "10px 12px",
  background: "#EEF4FF",
  border: "1px solid rgba(49,87,183,0.12)",
};
const eventRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  borderRadius: 16,
  padding: 14,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
};
const eventTitleStyle: CSSProperties = { margin: 0, fontSize: 15, color: "#0F172A" };
const eventNotesStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" };
const timeChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 999,
  padding: "5px 10px",
  background: "#FFFFFF",
  color: "#475467",
  fontSize: 12,
  fontWeight: 700,
};
const deleteButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "none",
  background: "#FFFFFF",
  color: "#667085",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
const emptyLineStyle: CSSProperties = { fontSize: 13, color: "#94A3B8", padding: "4px 2px" };
const emptyStyle: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: "#F8FAFC",
  border: "1px dashed rgba(148,163,184,0.24)",
  fontSize: 14,
  lineHeight: 1.8,
  color: "#64748B",
};
const modalBackdropStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 200 };
const modalStyle: CSSProperties = { width: "100%", maxWidth: 560, borderRadius: 24, padding: 22, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", boxShadow: "0 24px 48px rgba(15,23,42,0.18)" };
const modalHeadStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 };
const closeButtonStyle: CSSProperties = { width: 36, height: 36, borderRadius: 12, border: "none", background: "#F8FAFC", color: "#667085", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const inputStyle: CSSProperties = { width: "100%", borderRadius: 14, border: "1px solid rgba(148,163,184,0.24)", background: "#FFFFFF", padding: "12px 14px", fontSize: 14, color: "#0F172A", outline: "none" };
const typeButtonStyle = (active: boolean, color: string, bg: string): CSSProperties => ({
  borderRadius: 999,
  padding: "8px 12px",
  border: active ? `1.5px solid ${color}` : "1px solid rgba(148,163,184,0.24)",
  background: active ? bg : "#FFFFFF",
  color,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});
const saveButtonStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: disabled ? "#D0D5DD" : "linear-gradient(135deg, #3555C6, #5E78DA)",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 800,
  cursor: disabled ? "not-allowed" : "pointer",
});
