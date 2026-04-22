"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { Medal, Sparkles, Trophy, Users } from "lucide-react";

type RankingItem = {
  rank: number;
  studentId: string;
  name: string;
  totalMinutes: number;
};

type RankingResponse = {
  scope: "all" | "friends";
  friendCount: number;
  studyRanking: RankingItem[];
  myRanking: RankingItem | null;
  student: {
    name: string;
    target_univ: string | null;
  };
};

function formatStudyMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}

export default function RankingPage() {
  const [scope, setScope] = useState<"all" | "friends">("all");
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRanking = useCallback(async (nextScope: "all" | "friends") => {
    setLoading(true);
    const res = await fetch(`/api/timeline?scope=${nextScope}`, { cache: "no-store" });
    const json: RankingResponse = await res.json();
    setData(json);
    setScope(nextScope);
    setLoading(false);
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadRanking("all");
  }, 0);
  return () => window.clearTimeout(timer);
}, [loadRanking]);

  const topMinutes = data?.studyRanking[0]?.totalMinutes ?? 0;
  const totalMinutes = useMemo(() => data?.studyRanking.reduce((sum, entry) => sum + entry.totalMinutes, 0) ?? 0, [data]);

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={shellStyle}>
          <section style={mainCardStyle}>
            <div style={heroStyle}>
              <div>
                <div style={eyebrowStyle}>Study Ranking</div>
                <h1 style={titleStyle}>勉強時間ランキング</h1>
                <p style={subtitleStyle}>今週どれだけ積み上げたかを、みんなと友達で切り替えて見られます。</p>
              </div>

              <div style={heroStatsStyle}>
                <MiniMetric label="集計範囲" value={scope === "friends" ? "友達" : "みんな"} />
                <MiniMetric label="総勉強時間" value={formatStudyMinutes(totalMinutes)} />
                <MiniMetric label="1位の学習量" value={formatStudyMinutes(topMinutes)} />
              </div>
            </div>

            <div style={tabBarStyle}>
              <button type="button" onClick={() => void loadRanking("all")} style={scope === "all" ? activeTabStyle : tabStyle}>みんな</button>
              <button type="button" onClick={() => void loadRanking("friends")} style={scope === "friends" ? activeTabStyle : tabStyle}>友達</button>
            </div>

            {loading ? (
              <div style={emptyStyle}>ランキングを読み込んでいます...</div>
            ) : data?.studyRanking.length ? (
              <div style={listStyle}>
                {data.studyRanking.map((entry, index) => (
                  <article key={entry.studentId} style={rowStyle}>
                    <div style={rankBadgeStyle(index)}>{entry.rank}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={nameStyle}>{entry.name}</div>
                      <div style={timeStyle}>{formatStudyMinutes(entry.totalMinutes)}</div>
                    </div>
                    <div style={placeStyle}>
                      <Trophy size={16} strokeWidth={2.2} />
                      #{entry.rank}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={emptyStyle}>
                {scope === "friends"
                  ? "まだ友達の勉強時間記録はありません。友達を追加するとここに並びます。"
                  : "まだ勉強時間の記録がありません。演習を進めるとランキングに反映されます。"}
              </div>
            )}
          </section>

          <aside style={asideStyle}>
            <section style={asideCardStyle}>
              <div style={asideTitleStyle}>自分の順位</div>
              {data?.myRanking ? (
                <>
                  <div style={myRankStyle}>#{data.myRanking.rank}</div>
                  <div style={myMinutesStyle}>{formatStudyMinutes(data.myRanking.totalMinutes)}</div>
                  <p style={asideTextStyle}>{data.student.name} さんの今週の積み上げです。</p>
                </>
              ) : (
                <p style={asideTextStyle}>まだ集計対象の勉強時間がありません。</p>
              )}
            </section>

            <section style={asideCardStyle}>
              <div style={asideTitleStyle}>切り替え</div>
              <div style={chipStackStyle}>
                <InfoChip icon={<Users size={14} strokeWidth={2.2} />} text={`友達数 ${data?.friendCount ?? 0}人`} />
                <InfoChip icon={<Sparkles size={14} strokeWidth={2.2} />} text={scope === "friends" ? "友達だけを表示中" : "全体ランキングを表示中"} />
                <InfoChip icon={<Medal size={14} strokeWidth={2.2} />} text="集計は今週分の演習時間" />
              </div>
            </section>

            <section style={asideCardStyle}>
              <div style={asideTitleStyle}>ショートカット</div>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <Link href="/timeline" style={linkCardStyle}>タイムラインを見る</Link>
                <Link href="/friends" style={linkCardStyle}>友達を探す</Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniMetricStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={miniValueStyle}>{value}</div>
    </div>
  );
}

function InfoChip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div style={chipStyle}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

const pageStyle: CSSProperties = { minHeight: "100dvh", padding: "18px 16px 96px" };
const shellStyle: CSSProperties = { maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 18, alignItems: "start" };
const mainCardStyle: CSSProperties = { borderRadius: 28, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148, 163, 184, 0.14)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)", overflow: "hidden" };
const heroStyle: CSSProperties = { padding: 22, display: "grid", gap: 18, borderBottom: "1px solid rgba(226, 232, 240, 0.9)", background: "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(255,255,255,0.96) 100%)" };
const eyebrowStyle: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3157B7" };
const titleStyle: CSSProperties = { margin: "6px 0 0", fontSize: 28, fontWeight: 900, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: "8px 0 0", fontSize: 14, lineHeight: 1.8, color: "#64748B" };
const heroStatsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const miniMetricStyle: CSSProperties = { borderRadius: 18, padding: 14, background: "rgba(255,255,255,0.84)", border: "1px solid rgba(148, 163, 184, 0.16)" };
const miniLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748B" };
const miniValueStyle: CSSProperties = { marginTop: 6, fontSize: 17, fontWeight: 900, color: "#0F172A" };
const tabBarStyle: CSSProperties = { display: "flex", borderBottom: "1px solid rgba(226, 232, 240, 0.9)" };
const tabStyle: CSSProperties = { flex: 1, border: "none", background: "transparent", padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#64748B", cursor: "pointer" };
const activeTabStyle: CSSProperties = { ...tabStyle, color: "#0F172A", boxShadow: "inset 0 -3px 0 #2563EB" };
const listStyle: CSSProperties = { display: "grid" };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderBottom: "1px solid rgba(226, 232, 240, 0.8)" };
const nameStyle: CSSProperties = { fontSize: 15, fontWeight: 800, color: "#0F172A" };
const timeStyle: CSSProperties = { marginTop: 4, fontSize: 13, color: "#64748B" };
const placeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 10px", background: "#F8FAFC", color: "#475569", fontSize: 12, fontWeight: 800 };
const emptyStyle: CSSProperties = { padding: 24, fontSize: 14, lineHeight: 1.8, color: "#64748B" };
const asideStyle: CSSProperties = { display: "grid", gap: 14, position: "sticky", top: 82 };
const asideCardStyle: CSSProperties = { borderRadius: 22, padding: 18, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148, 163, 184, 0.14)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)" };
const asideTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0F172A" };
const myRankStyle: CSSProperties = { marginTop: 10, fontSize: 28, fontWeight: 900, color: "#0F172A" };
const myMinutesStyle: CSSProperties = { marginTop: 6, fontSize: 14, fontWeight: 700, color: "#3157B7" };
const asideTextStyle: CSSProperties = { margin: "8px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" };
const chipStackStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 12 };
const chipStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 16, padding: "10px 12px", background: "#F8FAFC", border: "1px solid rgba(148, 163, 184, 0.14)", fontSize: 13, fontWeight: 700, color: "#475569" };
const linkCardStyle: CSSProperties = { display: "block", textDecoration: "none", borderRadius: 16, padding: "12px 14px", background: "#F8FAFC", border: "1px solid rgba(148, 163, 184, 0.14)", color: "#0F172A", fontSize: 14, fontWeight: 800 };

function rankBadgeStyle(index: number): CSSProperties {
  const palette = [
    { bg: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)", color: "#B45309" },
    { bg: "linear-gradient(135deg, #E2E8F0 0%, #F8FAFC 100%)", color: "#475569" },
    { bg: "linear-gradient(135deg, #FCE7F3 0%, #FFF1F2 100%)", color: "#BE185D" },
  ];
  const tone = palette[index] ?? { bg: "linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)", color: "#1D4ED8" };

  return {
    width: 48,
    height: 48,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: tone.bg,
    color: tone.color,
    fontSize: 16,
    fontWeight: 900,
    flexShrink: 0,
  };
}


