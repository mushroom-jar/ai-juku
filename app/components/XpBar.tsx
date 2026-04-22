"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame, Lock, Medal, Settings2, Sparkles, Stars, Trophy, Unlock, Users, X } from "lucide-react";

type LevelTheme = {
  level: number;
  title: string;
  subtitle: string;
  reward: string;
  accent: string;
  bg: string;
  unlocks?: string[];
};

type XpData = {
  xp: number;
  name: string;
  level: number;
  current: number;
  next: number;
  pct: number;
  streak: number;
  badgeCount: number;
  planLabel: string;
  targetUniv: string | null;
  examDate: string | null;
  totalStudyMinutes: number;
  totalSolvedProblems: number;
  totalQuestions: number;
  completedTasks: number;
  activeStudyDays: number;
  levelTheme?: LevelTheme | null;
  nextLevelTheme?: LevelTheme | null;
};

type BadgeInfo = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
};

type BadgeResponse = {
  badges: BadgeInfo[];
};

type UnlockToast = {
  id: string;
  label: string;
  description: string;
};

const listeners: Set<() => void> = new Set();
const STORAGE_KEY = "ai-juku-unlocked-badges";

const FALLBACK_THEME: LevelTheme = {
  level: 1,
  title: "",
  subtitle: "今日の積み上げを続けていこう",
  reward: "次のレベルまで少しずつ前進中",
  accent: "#2563EB",
  bg: "#EFF6FF",
};

export function refreshXpBar() {
  listeners.forEach((fn) => fn());
}

export default function XpBar() {
  const [data, setData] = useState<XpData | null>(null);
  const [open, setOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [toasts, setToasts] = useState<UnlockToast[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const [xpRes, badgeRes] = await Promise.all([
        fetch("/api/xp", { cache: "no-store" }),
        fetch("/api/badges", { cache: "no-store" }),
      ]);

      if (xpRes.ok) {
        const nextData: XpData = await xpRes.json();
        setData(nextData);
      }

      if (badgeRes.ok) {
        const badgeData: BadgeResponse = await badgeRes.json();
        maybeAnnounceBadges(badgeData.badges, setToasts);
      }
    };

    void load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3600)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  useEffect(() => {
    if (!open && !levelOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideProfile = panelRef.current?.contains(target);
      const insideLevel = levelRef.current?.contains(target);
      if (!insideProfile) {
        setOpen(false);
      }
      if (!insideLevel) {
        setLevelOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setLevelOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, levelOpen]);

  if (!data) {
    return (
      <div style={BAR_STYLE}>
        <div style={{ display: "flex", gap: 20 }}>
          {[48, 44, 58].map((w, i) => (
            <div key={i} style={{ width: w, height: 18, borderRadius: 6, background: "#F1F5F9" }} />
          ))}
        </div>
        <Divider />
        <div style={{ flex: 1, display: "grid", gap: 5 }}>
          <div style={{ width: "45%", height: 11, borderRadius: 6, background: "#F1F5F9" }} />
          <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#F1F5F9" }} />
        </div>
        <Divider />
        <div style={{ width: 52, height: 18, borderRadius: 6, background: "#F1F5F9", flexShrink: 0 }} />
        <Divider />
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", flexShrink: 0 }} />
      </div>
    );
  }

  const levelTheme = data.levelTheme ? { ...FALLBACK_THEME, ...data.levelTheme } : FALLBACK_THEME;
  const nextLevelTheme = data.nextLevelTheme ? { ...FALLBACK_THEME, ...data.nextLevelTheme } : null;
  const initial = data.name ? data.name.charAt(0).toUpperCase() : "?";
  const isMax = data.level >= 10;
  const remainingXp = Math.max(0, data.next - data.xp);
  const progressWidth = Math.min(100, Math.max(6, Number.isFinite(data.pct) ? data.pct : 0));
  const examDateLabel = data.examDate ? formatDate(data.examDate) : null;

  return (
    <>
      <div style={BAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <StatItem icon={<Flame size={17} strokeWidth={2.3} />} value={data.streak > 0 ? `${data.streak}日` : "0日"} color="#C2410C" />
          <StatItem icon={<Trophy size={17} strokeWidth={2.3} />} value={`${data.totalSolvedProblems}問`} color="#475569" />
        </div>

        <Divider />

        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isMax
              ? "レベル上限まで到達"
              : nextLevelTheme?.unlocks?.[0]
                ? `次で「${nextLevelTheme.unlocks[0]}」— あと ${remainingXp} XP`
                : `次のレベルまで ${remainingXp} XP`}
          </div>
          <div style={{ height: 6, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressWidth}%`,
                background: levelTheme.accent,
                borderRadius: 999,
                transition: "width 0.55s ease",
              }}
            />
          </div>
        </div>

        <Divider />

        <div ref={levelRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              setLevelOpen((value) => !value);
              setOpen(false);
            }}
            aria-label="レベルの詳細を見る"
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: levelTheme.accent,
              cursor: "pointer",
            }}
          >
            <Medal size={18} strokeWidth={2.3} />
            <span style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>Lv.{data.level}</span>
          </button>

          {levelOpen ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 34,
                width: 320,
                borderRadius: 22,
                border: "1px solid rgba(148,163,184,0.16)",
                background: "rgba(255,255,255,0.97)",
                boxShadow: "0 24px 70px rgba(15,23,42,0.18)",
                overflow: "hidden",
                zIndex: 120,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: `linear-gradient(180deg, ${levelTheme.bg} 0%, rgba(255,255,255,0.96) 100%)`,
                  borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: levelTheme.accent }}>
                      level perks
                    </div>
                    <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: "#0F172A" }}>Lv.{data.level}</div>
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7, color: "#475569" }}>{levelTheme.subtitle}</div>
                  </div>
                  <div
                    style={{
                      minWidth: 74,
                      borderRadius: 999,
                      padding: "7px 10px",
                      background: "#FFFFFF",
                      border: `1px solid ${alpha(levelTheme.accent, 0.18)}`,
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#0F172A",
                      textAlign: "center",
                    }}
                  >
                    {isMax ? "最大到達" : `あと ${remainingXp} XP`}
                  </div>
                </div>

                <div style={{ height: 8, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progressWidth}%`,
                      background: levelTheme.accent,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: 16, display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#64748B" }}>
                    今のレベル特典
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }}>{levelTheme.reward}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(levelTheme.unlocks ?? []).map((item) => (
                      <LevelItem key={item} icon={<Unlock size={12} strokeWidth={2.4} color={levelTheme.accent} />} label={item} active />
                    ))}
                  </div>
                </div>

                {nextLevelTheme ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#64748B" }}>
                      次のレベル特典
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }}>{nextLevelTheme.reward}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(nextLevelTheme.unlocks ?? []).map((item) => (
                        <LevelItem key={item} icon={<Lock size={12} strokeWidth={2.4} />} label={item} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 16,
                      padding: 14,
                      background: "#F8FAFC",
                      border: "1px solid rgba(148,163,184,0.14)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: "#334155",
                    }}
                  >
                    最終レベルまで到達しています。これまでの積み上げがしっかり形になっています。
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <Divider />

        <div ref={panelRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setLevelOpen(false);
            }}
            aria-label="プロフィールを開く"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: "linear-gradient(135deg, #1E293B 0%, #475569 100%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(15,23,42,0.18)",
              position: "relative",
              overflow: "visible",
            }}
          >
            <span style={{ position: "absolute", inset: 0, opacity: 0.18, background: "linear-gradient(180deg,#FFFFFF 0%,transparent 70%)", borderRadius: "50%" }} />
            <span style={{ position: "relative", zIndex: 1 }}>{initial}</span>
            <span style={{ position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: "50%", background: levelTheme.accent, border: "2px solid #fff", zIndex: 2 }} />
          </button>

          {open ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 44,
                width: 320,
                maxHeight: "calc(100dvh - 64px)",
                borderRadius: 24,
                border: "1px solid rgba(148,163,184,0.16)",
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 24px 70px rgba(15,23,42,0.18)",
                overflow: "auto",
                zIndex: 120,
              }}
            >
              <div
                style={{
                  padding: 18,
                  background: `linear-gradient(180deg, ${levelTheme.bg} 0%, rgba(255,255,255,0.96) 100%)`,
                  borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1E293B 0%, #475569 100%)",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 18,
                        fontWeight: 900,
                        boxShadow: "0 12px 22px rgba(15, 23, 42, 0.18)",
                      }}
                    >
                      {initial}
                    </div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>{data.name || "あなた"}</div><div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>{data.planLabel}</div><Link href="/me" onClick={() => setOpen(false)} style={{ marginTop: 8, display: "inline-flex", fontSize: 12, fontWeight: 800, color: "#1E293B", textDecoration: "none" }}>プロフィール詳細を見る</Link></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="閉じる"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      background: "rgba(255,255,255,0.85)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      color: "#475569",
                      flexShrink: 0,
                    }}
                  >
                    <X size={15} strokeWidth={2.4} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
                  <ProfileStat label="総勉強時間" value={formatStudyMinutes(data.totalStudyMinutes)} helper="演習ログの合計" />
                  <ProfileStat label="解いた問題" value={`${data.totalSolvedProblems}問`} helper="記録済みの問題数" />
                  <ProfileStat label="質問回数" value={`${data.totalQuestions}回`} helper="AIに相談した回数" />
                  <ProfileStat label="完了タスク" value={`${data.completedTasks}件`} helper="Todoを完了した回数" />
                </div>
              </div>

              <div style={{ padding: 18, display: "grid", gap: 16 }}>
                <PanelSection
                  title="プレイヤー情報"
                  subtitle={isMax ? "レベル上限まで到達しています" : `次のレベルまで ${remainingXp} XP`}
                >
                  <div style={heroDataStyle}>
                    <div style={heroBadgeStyle(levelTheme)}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: levelTheme.accent }}>
                        current
                      </div>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>Lv.{data.level}</div>
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: "#475569" }}>{levelTheme.reward}</div>
                    </div>

                    <div style={metaGridStyle}>
                      <MetaItem label="プラン" value={data.planLabel} />
                      <MetaItem label="活動日数" value={`${data.activeStudyDays}日`} />
                      {data.targetUniv ? <MetaItem label="志望校" value={data.targetUniv} /> : null}
                      {examDateLabel && examDateLabel !== "未設定" ? <MetaItem label="受験日" value={examDateLabel} /> : null}
                    </div>
                  </div>
                </PanelSection>

                <PanelSection title="今の状態" subtitle="現在の成長と継続状況">
                  <div style={dataGridStyle}>
                    <DataCard
                      icon={<Sparkles size={15} strokeWidth={2.2} />}
                      label="現在XP"
                      value={`${data.xp} XP`}
                      helper="積み上げた経験値"
                    />
                    <DataCard
                      icon={<Flame size={15} strokeWidth={2.2} />}
                      label="連続日数"
                      value={`${data.streak}日`}
                      helper="継続している日数"
                    />
                    <DataCard
                      icon={<Stars size={15} strokeWidth={2.2} />}
                      label="バッジ"
                      value={`${data.badgeCount}個`}
                      helper="解放済みの数"
                    />
                    <DataCard
                      icon={<Medal size={15} strokeWidth={2.2} />}
                      label="現在レベル"
                      value={`Lv.${data.level}`}
                      helper="いまの到達点"
                    />
                  </div>
                </PanelSection>

                <PanelSection title={`Lv.${data.level} の特典`} subtitle="今のレベルで受けられるメリット">
                  <div style={{ display: "grid", gap: 8 }}>
                  {(levelTheme.unlocks ?? []).map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 12px",
                        borderRadius: 12,
                        background: levelTheme.bg,
                        border: `1px solid ${alpha(levelTheme.accent, 0.14)}`,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0F172A",
                      }}
                    >
                      <Unlock size={12} strokeWidth={2.4} color={levelTheme.accent} style={{ flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                  </div>
                </PanelSection>

                {nextLevelTheme ? (
                  <PanelSection title={`Lv.${nextLevelTheme.level} の特典`} subtitle="次のレベルで増えるメリット">
                    <div style={{ display: "grid", gap: 8 }}>
                      {(nextLevelTheme.unlocks ?? []).map((item) => (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "9px 12px",
                            borderRadius: 12,
                            background: "#F8FAFC",
                            border: "1px solid rgba(148,163,184,0.14)",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#94A3B8",
                          }}
                        >
                          <Lock size={12} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                ) : null}

                <PanelSection title="ショートカット" subtitle="自分まわりの画面へ移動">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}><ProfileLink href="/me" icon={<Sparkles size={16} strokeWidth={2.2} />} label="プロフィール" onClick={() => setOpen(false)} /><ProfileLink href="/ranking" icon={<Trophy size={16} strokeWidth={2.2} />} label="ランキング" onClick={() => setOpen(false)} />
                    <ProfileLink href="/friends" icon={<Users size={16} strokeWidth={2.2} />} label="フレンド" onClick={() => setOpen(false)} />
                    <ProfileLink href="/badges" icon={<Stars size={16} strokeWidth={2.2} />} label="バッジ" onClick={() => setOpen(false)} />
                    <ProfileLink href="/progress" icon={<Medal size={16} strokeWidth={2.2} />} label="レベル" onClick={() => setOpen(false)} />
                  </div>
                </PanelSection>

                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 44,
                    borderRadius: 14,
                    textDecoration: "none",
                    background: "#0F172A",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  <Settings2 size={16} strokeWidth={2.2} />
                  設定を開く
                </Link>
              </div>
            </div>
          ) : null}
        </div>

      </div>

      {toasts.length > 0 ? (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 88,
            zIndex: 120,
            display: "grid",
            gap: 10,
            pointerEvents: "none",
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                width: 288,
                borderRadius: 20,
                padding: "14px 16px",
                background: "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 68%)",
                border: "1px solid rgba(245, 158, 11, 0.28)",
                boxShadow: "0 20px 48px rgba(245, 158, 11, 0.14)",
                display: "grid",
                gap: 8,
                animation: "badge-pop 0.35s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Trophy size={18} strokeWidth={2.3} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    badge unlocked
                  </div>
                  <div style={{ marginTop: 2, fontSize: 15, fontWeight: 900, color: "#0F172A" }}>{toast.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: "#7C5A10" }}>{toast.description}</div>
            </div>
          ))}
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes badge-pop {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}

function maybeAnnounceBadges(badges: BadgeInfo[], setToasts: React.Dispatch<React.SetStateAction<UnlockToast[]>>) {
  if (typeof window === "undefined") return;

  const unlocked = badges.filter((badge) => badge.unlocked);
  const currentIds = unlocked.map((badge) => badge.id);
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentIds));
    return;
  }

  let previousIds: string[] = [];
  try {
    previousIds = JSON.parse(raw) as string[];
  } catch {
    previousIds = [];
  }

  const newBadges = unlocked.filter((badge) => !previousIds.includes(badge.id));
  if (newBadges.length > 0) {
    setToasts((current) => [
      ...current,
      ...newBadges.map((badge) => ({ id: `${badge.id}-${Date.now()}`, label: badge.label, description: badge.description })),
    ]);
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentIds));
}

function ProfileStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background: "#F8FAFC",
        border: "1px solid rgba(148, 163, 184, 0.14)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: "#94A3B8" }}>{helper}</div>
    </div>
  );
}

function PanelSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#64748B" }}>
          {title}
        </div>
        {subtitle ? <div style={{ marginTop: 4, fontSize: 13, color: "#475569" }}>{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.74)",
        border: "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{value}</div>
    </div>
  );
}

function DataCard({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: "#F8FAFC",
        border: "1px solid rgba(148,163,184,0.14)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#64748B" }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{value}</div>
      <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94A3B8" }}>{helper}</div>
    </div>
  );
}

function LevelItem({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        background: active ? "#EFF6FF" : "#F8FAFC",
        border: active ? "1px solid rgba(37,99,235,0.14)" : "1px solid rgba(148,163,184,0.14)",
        fontSize: 12,
        fontWeight: 700,
        color: active ? "#0F172A" : "#475569",
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function alpha(hex: string, opacity: number) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function formatStudyMinutes(totalMinutes: number) {
  if (!totalMinutes || totalMinutes <= 0) return "0分";
  if (totalMinutes < 60) return `${totalMinutes}分`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}

function formatDate(value: string) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  if (date.getFullYear() <= 1970) return "未設定";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function heroBadgeStyle(levelTheme: LevelTheme) {
  return {
    borderRadius: 18,
    padding: 14,
    background: `linear-gradient(135deg, ${levelTheme.bg} 0%, rgba(255,255,255,0.98) 100%)`,
    border: `1px solid ${alpha(levelTheme.accent, 0.16)}`,
  } as const;
}

const heroDataStyle = {
  display: "grid",
  gap: 10,
} as const;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
} as const;

const dataGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
} as const;

const BAR_STYLE: React.CSSProperties = {
  height: 46,
  background: "rgba(255,255,255,0.92)",
  borderBottom: "1px solid rgba(148,163,184,0.16)",
  backdropFilter: "blur(18px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  position: "sticky",
  top: 0,
  zIndex: 60,
};

function Divider() {
  return <div style={{ width: 1, height: 18, background: "rgba(148,163,184,0.18)", flexShrink: 0 }} />;
}

function StatItem({ icon, value, color }: { icon: ReactNode; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <span style={{ color, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{value}</span>
    </div>
  );
}

function ProfileLink({ href, icon, label, onClick }: { href: string; icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 44,
        padding: "0 14px",
        borderRadius: 14,
        textDecoration: "none",
        background: "#F8FAFC",
        border: "1px solid rgba(148, 163, 184, 0.14)",
        color: "#0F172A",
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {icon}
      {label}
    </Link>
  );
}










