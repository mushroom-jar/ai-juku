"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { SUBJECT_BG, SUBJECT_COLOR, SUBJECT_LABEL } from "@/lib/types";
import { AlertTriangle, BookOpen, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

type ReviewItem = {
  id: string;
  book_id: string;
  problem_no: number;
  sub_no: number;
  subsub_no: number;
  attempt_no: number;
  result: "wrong" | "unsure" | "checked";
  recorded_at: string;
  book: { id: string; title: string; subject: string } | null;
};

type Summary = { wrong: number; unsure: number; checked: number; total: number };
type Filter = "all" | "wrong" | "unsure" | "checked";

const RESULT_CONFIG = {
  wrong: { icon: XCircle, color: "#D92D20", bg: "#FEF3F2", border: "#FECACA", label: "苦戦" },
  unsure: { icon: AlertTriangle, color: "#B54708", bg: "#FFFAEB", border: "#FDE68A", label: "不安" },
  checked: { icon: BookOpen, color: "#175CD3", bg: "#EFF8FF", border: "#B2DDFF", label: "確認" },
} as const;

const CIRCLED = ["", "(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)", "(10)"];

function problemLabel(no: number, sub: number, subsub: number) {
  let label = `第${no}問`;
  if (sub > 0) label += `-${sub}`;
  if (subsub > 0 && subsub < CIRCLED.length) label += ` ${CIRCLED[subsub]}`;
  return label;
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function ReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ wrong: 0, unsure: 0, checked: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/review")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setSummary(data.summary ?? { wrong: 0, unsure: 0, checked: 0, total: 0 });
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return filter === "all" ? items : items.filter((item) => item.result === filter);
  }, [filter, items]);

  if (loading) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Review List</p>
            <h1 style={titleStyle}>復習リスト</h1>
            <p style={descriptionStyle}>
              つまずいた問題だけをまとめて見返せる画面です。忘れる前に戻りたい順で並ぶので、今日の復習をすぐ始められます。
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, ...metaPillStyle }}>
            <RotateCcw size={14} />
            復習候補 {summary.total}件
          </div>
        </section>

        <section style={statsGridStyle}>
          {(["wrong", "unsure", "checked"] as const).map((key) => {
            const cfg = RESULT_CONFIG[key];
            const Icon = cfg.icon;
            return (
              <div key={key} style={{ ...statCardStyle, background: cfg.bg, borderColor: cfg.border }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ ...statLabelStyle, color: cfg.color }}>{cfg.label}</p>
                  <Icon size={16} color={cfg.color} />
                </div>
                <p style={{ ...statValueStyle, color: cfg.color }}>{summary[key]}</p>
                <p style={statSubStyle}>この状態の問題をまとめています</p>
              </div>
            );
          })}
        </section>

        <section style={cardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {([
              { key: "all", label: `すべて ${summary.total}` },
              { key: "wrong", label: `苦戦 ${summary.wrong}` },
              { key: "unsure", label: `不安 ${summary.unsure}` },
              { key: "checked", label: `確認 ${summary.checked}` },
            ] as { key: Filter; label: string }[]).map((item) => (
              <button key={item.key} onClick={() => setFilter(item.key)} style={filterButtonStyle(filter === item.key)}>
                {item.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={emptyStateStyle}>
              <CheckCircle2 size={38} color="#12B76A" strokeWidth={1.8} />
              <div>
                <p style={{ margin: "10px 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>復習候補はありません</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  今の復習リストは空です。演習を進めながら、戻りたい問題を記録していきましょう。
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((item) => {
                const cfg = RESULT_CONFIG[item.result];
                const Icon = cfg.icon;
                const days = daysSince(item.recorded_at);
                const subject = item.book?.subject ?? "other";
                return (
                  <button key={item.id} onClick={() => router.push(`/shelf/${item.book_id}`)} style={reviewItemStyle(cfg.color)}>
                    <div style={{ ...resultIconWrapStyle, background: cfg.bg }}>
                      <Icon size={16} color={cfg.color} strokeWidth={2.2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <span style={subjectPillStyle(subject)}>{SUBJECT_LABEL[subject] ?? subject}</span>
                        <span style={statusPillStyle(cfg.bg, cfg.color)}>{cfg.label}</span>
                      </div>
                      <p style={itemTitleStyle}>{problemLabel(item.problem_no, item.sub_no, item.subsub_no)}</p>
                      <p style={itemSubStyle}>{item.book?.title ?? "教材名未設定"}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={dayLabelStyle(days)}>{days === 0 ? "今日" : `${days}日前`}</p>
                      <p style={daySubStyle}>最後に記録</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 840,
  margin: "0 auto",
  padding: "24px 16px 88px",
  display: "grid",
  gap: 18,
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  padding: "24px 24px 20px",
};

const eyebrowStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" };
const titleStyle: React.CSSProperties = { margin: "6px 0 8px", fontSize: 28, lineHeight: 1.2, fontWeight: 800, color: "var(--text-primary)" };
const descriptionStyle: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)", maxWidth: 680 };
const metaPillStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 999, background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" };

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const statCardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: "16px 18px",
  display: "grid",
  gap: 6,
};

const statLabelStyle: React.CSSProperties = { margin: 0, fontSize: 12, fontWeight: 800 };
const statValueStyle: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1 };
const statSubStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-secondary)" };

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 14,
};

const filterButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: active ? "none" : "1px solid var(--border)",
  background: active ? "var(--accent)" : "var(--bg-elevated)",
  color: active ? "#fff" : "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});

const emptyStateStyle: React.CSSProperties = {
  minHeight: 220,
  borderRadius: 18,
  background: "var(--bg-elevated)",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: "24px 28px",
};

const reviewItemStyle = (color: string): React.CSSProperties => ({
  width: "100%",
  border: `1px solid ${color}22`,
  borderLeft: `4px solid ${color}`,
  background: "#fff",
  borderRadius: 18,
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
});

const resultIconWrapStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const subjectPillStyle = (subject: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  background: SUBJECT_BG[subject] ?? "var(--bg-elevated)",
  color: SUBJECT_COLOR[subject] ?? "var(--text-secondary)",
  fontSize: 11,
  fontWeight: 800,
});

const statusPillStyle = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 11,
  fontWeight: 800,
});

const itemTitleStyle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text-primary)" };
const itemSubStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" };
const dayLabelStyle = (days: number): React.CSSProperties => ({ margin: 0, fontSize: 13, fontWeight: 800, color: days >= 7 ? "#D92D20" : days >= 3 ? "#B54708" : "var(--text-primary)" });
const daySubStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" };

const loadingWrapStyle: React.CSSProperties = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" };
const spinnerStyle: React.CSSProperties = { width: 36, height: 36, border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
