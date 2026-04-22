"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/app/components/AppLayout";
import { CalendarDays, Flame, Medal, Sparkles, Trophy } from "lucide-react";

type Badge = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
};

type BadgeResponse = {
  continuity: {
    currentStreak: number;
    longestStreak: number;
    activeDays: number;
    unlockedBadgeIds: string[];
  };
  badges: Badge[];
};

const EMOJI_MAP: Record<string, string> = {
  seed: "芽",
  flame: "炎",
  rocket: "速",
  calendar: "暦",
  spark: "問",
  trophy: "演",
  star: "星",
};

export default function BadgesPage() {
  const [data, setData] = useState<BadgeResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/badges", { cache: "no-store" });
      if (!res.ok) return;
      const nextData: BadgeResponse = await res.json();
      setData(nextData);
    };

    void load();
  }, []);

  const unlocked = useMemo(() => data?.badges.filter((badge) => badge.unlocked) ?? [], [data]);
  const locked = useMemo(() => data?.badges.filter((badge) => !badge.unlocked) ?? [], [data]);

  return (
    <AppLayout>
      <div style={{ padding: "28px 24px 80px", display: "grid", gap: 22 }}>
        <section
          style={{
            borderRadius: 28,
            padding: "24px 24px 22px",
            background: "linear-gradient(135deg, #FFFDF5 0%, #FFFFFF 58%, #F8FAFC 100%)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            boxShadow: "0 22px 48px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 18 }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 800 }}>
                <Medal size={13} strokeWidth={2.3} />
                badges
              </div>
              <h1 style={{ margin: "14px 0 0", fontSize: 30, lineHeight: 1.15, color: "#0F172A", fontWeight: 900 }}>
                集めたバッジと、次に狙えるバッジ
              </h1>
              <p style={{ margin: "10px 0 0", maxWidth: 620, fontSize: 14, lineHeight: 1.8, color: "#475569" }}>
                取れたバッジと、まだ眠っているバッジをまとめて見られるページです。次にどの行動を増やすと解放が進むか、ひと目で分かるようにしています。
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 10, minWidth: "min(100%, 360px)" }}>
              <MetricCard icon={<Trophy size={15} strokeWidth={2.3} />} label="解放済み" value={`${unlocked.length}個`} note="owned" />
              <MetricCard icon={<Flame size={15} strokeWidth={2.3} />} label="連続日数" value={data ? `${data.continuity.currentStreak}日` : "-"} note="streak" />
              <MetricCard icon={<CalendarDays size={15} strokeWidth={2.3} />} label="学習日数" value={data ? `${data.continuity.activeDays}日` : "-"} note="all time" />
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18 }}>
          <div style={panelStyle}>
            <SectionTitle title="解放済み" subtitle="今までの積み上がり" />
            <div style={{ display: "grid", gap: 12 }}>
              {unlocked.length > 0 ? unlocked.map((badge) => <BadgeCard key={badge.id} badge={badge} unlocked />) : <EmptyState text="まだバッジがありません。最初の記録から始めよう。" />}
            </div>
          </div>

          <div style={panelStyle}>
            <SectionTitle title="これから取れる" subtitle="次の目標が見える" />
            <div style={{ display: "grid", gap: 12 }}>
              {locked.length > 0 ? locked.map((badge) => <BadgeCard key={badge.id} badge={badge} />) : <EmptyState text="すべてのバッジを解放済みです。かなり良いです。" />}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div style={{ borderRadius: 20, border: "1px solid rgba(148, 163, 184, 0.14)", background: "#FFFFFF", padding: "14px 16px", display: "grid", gap: 8 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 900, color: "#0F172A" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{note}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#64748B" }}>{subtitle}</div>
    </div>
  );
}

function BadgeCard({ badge, unlocked = false }: { badge: Badge; unlocked?: boolean }) {
  return (
    <div
      style={{
        borderRadius: 22,
        padding: "16px 16px 15px",
        border: unlocked ? "1px solid rgba(245, 158, 11, 0.28)" : "1px solid rgba(148, 163, 184, 0.14)",
        background: unlocked ? "linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)" : "#F8FAFC",
        opacity: unlocked ? 1 : 0.82,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: unlocked ? "linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)" : "linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)",
              color: unlocked ? "#FFFFFF" : "#475569",
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {EMOJI_MAP[badge.emoji] ?? badge.emoji}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>{badge.label}</div>
            <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.7, color: "#64748B" }}>{badge.description}</div>
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: unlocked ? "#FEF3C7" : "#E2E8F0", color: unlocked ? "#92400E" : "#475569", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          <Sparkles size={12} strokeWidth={2.3} />
          {unlocked ? "解放済み" : "未解放"}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ borderRadius: 20, padding: "20px 18px", background: "#F8FAFC", border: "1px dashed rgba(148, 163, 184, 0.24)", fontSize: 13, color: "#64748B", lineHeight: 1.8 }}>
      {text}
    </div>
  );
}

const panelStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  background: "#FFFFFF",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
};
