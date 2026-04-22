"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { HeartHandshake, Sparkles, TrendingUp, Trophy, Users } from "lucide-react";
import { SUBJECT_LABEL as SUBJECT_LABEL_LIB } from "@/lib/types";

type ActivityItem = {
  id: string;
  actor_name: string;
  feed_type: string;
  title: string;
  body: string | null;
  xp_delta: number;
  metadata: Record<string, unknown>;
  created_at: string;
  reaction_count: number;
  reacted: boolean;
};

type RankingItem = {
  rank: number;
  studentId: string;
  name: string;
  totalMinutes: number;
};

type PracticeSessionItem = {
  id: string;
  title: string | null;
  studyMinutes: number;
  source: string;
  startedAt: string | null;
  endedAt: string | null;
  bookId: string | null;
  bookTitle: string | null;
  subject: string | null;
};

type TimelineResponse = {
  student: {
    name: string;
    target_univ: string | null;
  };
  scope: "all" | "friends" | "self";
  friendCount: number;
  activityFeed: ActivityItem[];
  practiceSessions: PracticeSessionItem[];
  studyRanking: RankingItem[];
  myRanking: RankingItem | null;
};

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function avatarText(name: string) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function formatStudyMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}

function subjectLabel(subject: string | null) {
  if (subject && SUBJECT_LABEL_LIB[subject]) return SUBJECT_LABEL_LIB[subject];
  return "自由演習";
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "friends" | "self">("all");

  const loadTimeline = useCallback(async (nextScope: "all" | "friends" | "self") => {
    setLoading(true);
    const res = await fetch(`/api/timeline?scope=${nextScope}`, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setScope(nextScope);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTimeline("all");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTimeline]);

  const totalCheers = useMemo(() => data?.activityFeed.reduce((sum, item) => sum + item.reaction_count, 0) ?? 0, [data]);
  const totalXp = useMemo(() => data?.activityFeed.reduce((sum, item) => sum + Math.max(item.xp_delta, 0), 0) ?? 0, [data]);
  const ownMinutes = useMemo(() => data?.practiceSessions.reduce((sum, item) => sum + item.studyMinutes, 0) ?? 0, [data]);

  async function toggleReaction(activityId: string) {
    await fetch("/api/activity-feed/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, reaction: "cheer" }),
    });
    await loadTimeline(scope);
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={shellStyle}>
          <section style={feedStyle}>
            <header style={feedHeaderStyle}>
              <div>
                <h1 style={titleStyle}>タイムライン</h1>
                <p style={subtitleStyle}>みんなの学習ログ、友達の積み上がり、自分の演習履歴を切り替えて見返せます。</p>
              </div>
            </header>

            <div style={tabBarStyle}>
              <button type="button" onClick={() => void loadTimeline("all")} style={scope === "all" ? activeTabStyle : tabStyle}>みんな</button>
              <button type="button" onClick={() => void loadTimeline("friends")} style={scope === "friends" ? activeTabStyle : tabStyle}>友達</button>
              <button type="button" onClick={() => void loadTimeline("self")} style={scope === "self" ? activeTabStyle : tabStyle}>自分</button>
            </div>

            {loading ? (
              <div style={emptyWrapStyle}>タイムラインを読み込んでいます...</div>
            ) : scope === "self" ? (
              data && data.practiceSessions.length > 0 ? (
                <div>
                  {data.practiceSessions.map((item) => (
                    <article key={item.id} style={tweetStyle}>
                      <div style={avatarStyle}>{avatarText(data.student.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={tweetHeaderStyle}>
                          <span style={tweetNameStyle}>{data.student.name}</span>
                        <span style={tweetMetaStyle}>・ {item.endedAt ? formatRelativeTime(item.endedAt) : "さっき"}</span>
                      </div>
                        <div style={tweetTitleStyle}>
                          {item.bookTitle
                            ? `${item.bookTitle} を ${formatStudyMinutes(item.studyMinutes)} 演習`
                            : item.title
                              ? `${item.title} を ${formatStudyMinutes(item.studyMinutes)} 記録`
                              : `${formatStudyMinutes(item.studyMinutes)} の自由演習を記録`}
                        </div>
                        <p style={tweetBodyStyle}>{subjectLabel(item.subject)} / {item.source === "practice" ? "演習から保存" : item.source}</p>
                        <div style={badgeRowStyle}>
                          <span style={xpBadgeStyle}><Trophy size={13} />{formatStudyMinutes(item.studyMinutes)}</span>
                          <span style={typeBadgeStyle}>自分の演習履歴</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div style={emptyWrapStyle}>まだ自分の演習履歴はありません。演習時間を保存するとここに並びます。</div>
              )
            ) : data && data.activityFeed.length > 0 ? (
              <div>
                {data.activityFeed.map((item) => (
                  <article key={item.id} style={tweetStyle}>
                    <div style={avatarStyle}>{avatarText(item.actor_name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={tweetHeaderStyle}>
                        <span style={tweetNameStyle}>{item.actor_name}</span>
                        <span style={tweetMetaStyle}>・ {formatRelativeTime(item.created_at)}</span>
                      </div>
                      <div style={tweetTitleStyle}>{item.title}</div>
                      {item.body ? <p style={tweetBodyStyle}>{item.body}</p> : null}
                      <div style={badgeRowStyle}>
                        <span style={xpBadgeStyle}><Trophy size={13} />{item.xp_delta >= 0 ? `+${item.xp_delta}` : item.xp_delta} XP</span>
                        <span style={typeBadgeStyle}>{feedTypeLabel(item.feed_type)}</span>
                      </div>
                      <div style={actionRowStyle}>
                        <button onClick={() => void toggleReaction(item.id)} style={item.reacted ? reactedActionStyle : actionStyle}>
                          <HeartHandshake size={16} />応援する<span style={actionCountStyle}>{item.reaction_count}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={emptyWrapStyle}>
                {scope === "friends" ? "まだ友達の学習ログはありません。友達を追加するとここに流れてきます。" : "まだ学習ログはありません。Todo完了や演習記録をするとここに流れてきます。"}
              </div>
            )}
          </section>

          <aside style={asideStyle}>
            <section style={asideCardStyle}>
              <div style={asideTitleStyle}>最近の動き</div>
              <div style={metricStackStyle}>
                <AsideMetric icon={<TrendingUp size={15} color="#2563EB" />} label="投稿数" value={data?.activityFeed.length ?? 0} />
                <AsideMetric icon={<Sparkles size={15} color="#C2410C" />} label="応援" value={totalCheers} />
                <AsideMetric icon={<Trophy size={15} color="#B45309" />} label="獲得XP" value={totalXp} />
                <AsideMetric icon={<Trophy size={15} color="#7C3AED" />} label="自分の演習時間" value={formatStudyMinutes(ownMinutes)} />
              </div>
            </section>

            <section style={asideCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={asideTitleStyle}>{scope === "friends" ? "友達の勉強時間ランキング" : "今週の勉強時間ランキング"}</div>
                <Link href="/friends" style={friendLinkStyle}><Users size={14} strokeWidth={2.3} /> 友達</Link>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {data?.studyRanking.length ? data.studyRanking.map((entry) => (
                  <div key={entry.studentId} style={rankingRowStyle}>
                    <div style={rankingRankStyle}>#{entry.rank}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={rankingNameStyle}>{entry.name}</div>
                      <div style={rankingTimeStyle}>{formatStudyMinutes(entry.totalMinutes)}</div>
                    </div>
                  </div>
                )) : <div style={{ fontSize: 13, lineHeight: 1.8, color: "#64748B" }}>{scope === "friends" ? "まだ友達の勉強時間記録はありません。" : "まだ勉強時間の記録がありません。"}</div>}
              </div>

              {data?.myRanking ? (
                <div style={myRankCardStyle}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>your rank</div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>#{data.myRanking.rank}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#475569" }}>{formatStudyMinutes(data.myRanking.totalMinutes)}</div>
                </div>
              ) : null}
            </section>

            <section style={asideCardStyle}>
              <div style={asideTitleStyle}>あなた</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{data?.student.name ?? "..."}</p>
              {data?.student.target_univ ? <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#64748B" }}>志望校: {data.student.target_univ}</p> : null}
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748B" }}>友達数: {data?.friendCount ?? 0}人</p>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function AsideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div style={metricCardStyle}><div style={metricLabelStyle}>{icon}{label}</div><div style={metricValueStyle}>{value}</div></div>;
}

function feedTypeLabel(feedType: string) {
  switch (feedType) {
    case "task_complete": return "Todo";
    case "problem_result":
    case "practice_logged":
    case "practice_perfect": return "演習";
    case "mock_exam": return "模試";
    default: return "学習";
  }
}

const pageStyle: CSSProperties = { minHeight: "100dvh", padding: "18px 16px 96px" };
const shellStyle: CSSProperties = { maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 18, alignItems: "start" };
const feedStyle: CSSProperties = { borderRadius: 24, overflow: "hidden", background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148, 163, 184, 0.14)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)" };
const feedHeaderStyle: CSSProperties = { padding: "20px 20px 14px", borderBottom: "1px solid rgba(226, 232, 240, 0.9)" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" };
const tabBarStyle: CSSProperties = { display: "flex", alignItems: "center", borderBottom: "1px solid rgba(226, 232, 240, 0.9)" };
const tabStyle: CSSProperties = { flex: 1, border: "none", background: "transparent", padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "#64748B", cursor: "pointer" };
const activeTabStyle: CSSProperties = { ...tabStyle, color: "#0F172A", boxShadow: "inset 0 -3px 0 #2563EB" };
const tweetStyle: CSSProperties = { display: "flex", gap: 12, padding: "18px 20px", borderBottom: "1px solid rgba(226, 232, 240, 0.8)" };
const avatarStyle: CSSProperties = { width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #DBEAFE, #E0E7FF)", color: "#1D4ED8", fontSize: 15, fontWeight: 900, flexShrink: 0 };
const tweetHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const tweetNameStyle: CSSProperties = { fontSize: 15, fontWeight: 800, color: "#0F172A" };
const tweetMetaStyle: CSSProperties = { fontSize: 13, color: "#64748B" };
const tweetTitleStyle: CSSProperties = { marginTop: 4, fontSize: 15, lineHeight: 1.7, fontWeight: 700, color: "#0F172A" };
const tweetBodyStyle: CSSProperties = { margin: "8px 0 0", fontSize: 14, lineHeight: 1.8, color: "#475467" };
const badgeRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 };
const xpBadgeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 10px", background: "#FFF7ED", color: "#C2410C", fontSize: 12, fontWeight: 800 };
const typeBadgeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: "#EEF2FF", color: "#4338CA", fontSize: 12, fontWeight: 800 };
const actionRowStyle: CSSProperties = { display: "flex", alignItems: "center", marginTop: 14 };
const actionStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#64748B", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 };
const reactedActionStyle: CSSProperties = { ...actionStyle, color: "#C2410C" };
const actionCountStyle: CSSProperties = { fontSize: 12, color: "inherit" };
const emptyWrapStyle: CSSProperties = { padding: 24, fontSize: 14, lineHeight: 1.8, color: "#64748B" };
const asideStyle: CSSProperties = { display: "grid", gap: 14, position: "sticky", top: 82 };
const asideCardStyle: CSSProperties = { borderRadius: 22, padding: 18, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148, 163, 184, 0.14)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)" };
const asideTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0F172A" };
const metricStackStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 12 };
const metricCardStyle: CSSProperties = { borderRadius: 16, padding: 14, background: "#F8FAFC", border: "1px solid rgba(148, 163, 184, 0.14)" };
const metricLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64748B" };
const metricValueStyle: CSSProperties = { marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0F172A" };
const rankingRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 16, background: "#F8FAFC", border: "1px solid rgba(148, 163, 184, 0.14)" };
const rankingRankStyle: CSSProperties = { width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)", color: "#B45309", fontSize: 13, fontWeight: 900, flexShrink: 0 };
const rankingNameStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0F172A" };
const rankingTimeStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: "#64748B" };
const myRankCardStyle: CSSProperties = { marginTop: 14, borderRadius: 18, padding: 14, background: "linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 100%)", border: "1px solid rgba(79, 70, 229, 0.14)" };
const friendLinkStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12, fontWeight: 800, color: "#3157B7" };
