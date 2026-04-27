"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Flame,
  MessageSquareText,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";

type LevelTheme = {
  level: number;
  title: string;
  subtitle: string;
  reward: string;
  accent: string;
  bg: string;
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
};

type BadgeInfo = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
};

type MockExam = {
  id: string;
  exam_name: string;
  exam_date: string;
  total_score: number | null;
  total_max: number | null;
  total_deviation: number | null;
};

const QUICK_LINKS = [
  { href: "/reflection", label: "振り返る", Icon: Sparkles, color: "#B45309", bg: "#FEF3C7" },
  { href: "/badges", label: "バッジ", Icon: BadgeCheck, color: "#047857", bg: "#D1FAE5" },
  { href: "/ranking", label: "ランキング", Icon: Trophy, color: "#6D28D9", bg: "#EDE9FE" },
  { href: "/settings", label: "設定", Icon: Settings, color: "#475569", bg: "#E2E8F0" },
] as const;

export default function MePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<XpData | null>(null);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/xp"), fetch("/api/badges"), fetch("/api/mock-exams")])
      .then(async ([xpRes, badgeRes, examRes]) => {
        const xpJson = xpRes.ok ? ((await xpRes.json()) as XpData) : null;
        const badgeJson = badgeRes.ok ? ((await badgeRes.json()) as { badges?: BadgeInfo[] }) : { badges: [] };
        const examJson = examRes.ok ? ((await examRes.json()) as { exams?: MockExam[] }) : { exams: [] };
        setProfile(xpJson);
        setBadges(badgeJson.badges ?? []);
        setExams(examJson.exams ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div style={loadingWrapStyle}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div style={pageStyle}>
          <main style={mainStyle}>
            <div style={emptyStyle}>プロフィール情報を読み込めませんでした。</div>
          </main>
        </div>
      </AppLayout>
    );
  }

  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const latestExam = exams[0] ?? null;
  const remainingXp = Math.max(0, profile.next - profile.xp);
  const accent = profile.levelTheme?.accent ?? "#3157B7";
  const softBg = profile.levelTheme?.bg ?? "#EEF2FF";

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>
          <section style={heroCardStyle}>
            <div style={heroHeaderStyle}>
              <div style={avatarStyle}>{(profile.name || "?").slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={eyebrowStyle}>マイページ</div>
                <h1 style={heroTitleStyle}>{profile.name || "ユーザー"}</h1>
                <div style={pillRowStyle}>
                  <span style={primaryPillStyle(softBg, accent)}>{profile.planLabel}</span>
                  <span style={secondaryPillStyle}>Lv.{profile.level}</span>
                  {profile.targetUniv ? <span style={secondaryPillStyle}>{profile.targetUniv}</span> : null}
                </div>
              </div>
              <button onClick={() => router.push("/settings")} style={settingsButtonStyle}>
                <Settings size={15} />
                設定
              </button>
            </div>

            <div style={levelCardStyle(softBg)}>
              <div>
                <div style={levelLabelStyle}>次のレベルまで</div>
                <div style={levelValueStyle}>{remainingXp} XP</div>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={progressMetaStyle}>
                  <span>現在 {profile.xp} XP</span>
                  <span>{Math.round(profile.pct)}%</span>
                </div>
                <div style={progressTrackStyle}>
                  <div style={{ ...progressFillStyle, width: `${profile.pct}%`, background: accent }} />
                </div>
              </div>
            </div>
          </section>

          <section style={statsGridStyle}>
            <SimpleStatCard icon={<Clock3 size={15} />} label="勉強時間" value={formatStudyMinutes(profile.totalStudyMinutes)} />
            <SimpleStatCard icon={<CheckCircle2 size={15} />} label="解いた問題" value={`${profile.totalSolvedProblems}問`} />
            <SimpleStatCard icon={<MessageSquareText size={15} />} label="質問回数" value={`${profile.totalQuestions}回`} />
            <SimpleStatCard icon={<Flame size={15} />} label="連続日数" value={`${profile.streak}日`} />
          </section>

          <section style={contentGridStyle}>
            <div style={sectionCardStyle}>
              <SectionHead title="プロフィール" desc="今の目標と学習の積み上がりです。" />
              <div style={infoListStyle}>
                <InfoRow label="志望校" value={profile.targetUniv || "未設定"} />
                <InfoRow label="受験日" value={profile.examDate ? formatDate(profile.examDate) : "未設定"} />
                <InfoRow label="活動日数" value={`${profile.activeStudyDays}日`} />
                <InfoRow label="完了タスク" value={`${profile.completedTasks}件`} />
                <InfoRow label="バッジ" value={`${profile.badgeCount}個`} />
              </div>
            </div>

            <div style={sectionCardStyle}>
              <SectionHead title="よく使う項目" desc="よく見るページへすぐ移動できます。" />
              <div style={quickGridStyle}>
                {QUICK_LINKS.map(({ href, label, Icon, color, bg }) => (
                  <Link key={href} href={href} style={quickLinkStyle}>
                    <div style={{ ...quickIconStyle, color, background: bg }}>
                      <Icon size={18} />
                    </div>
                    <span style={quickLabelStyle}>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section style={contentGridStyle}>
            <div style={sectionCardStyle}>
              <SectionHead title="最近の成績" desc="直近の模試だけをシンプルに確認できます。" />
              {latestExam ? (
                <div style={examCardStyle}>
                  <div>
                    <div style={examTitleStyle}>{latestExam.exam_name}</div>
                    <div style={examSubStyle}>{formatDate(latestExam.exam_date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={examScoreStyle}>{formatScore(latestExam)}</div>
                    <div style={examSubStyle}>
                      {latestExam.total_deviation ? `偏差値 ${latestExam.total_deviation}` : "偏差値なし"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={emptyStyle}>まだ模試の記録がありません。</div>
              )}
            </div>

            <div style={sectionCardStyle}>
              <SectionHead title="最近のバッジ" desc="解放したバッジをいくつか表示しています。" />
              {unlockedBadges.length > 0 ? (
                <div style={badgeListStyle}>
                  {unlockedBadges.slice(0, 4).map((badge) => (
                    <div key={badge.id} style={badgeRowStyle}>
                      <div style={badgeEmojiStyle}>{badge.emoji}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={badgeTitleStyle}>{badge.label}</div>
                        <div style={badgeDescStyle}>{badge.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={emptyStyle}>まだ解放したバッジはありません。</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AppLayout>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: "grid", gap: 4, marginBottom: 14 }}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={sectionDescStyle}>{desc}</p>
    </div>
  );
}

function SimpleStatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
    </div>
  );
}

function formatStudyMinutes(minutes: number) {
  const safe = Number.isFinite(minutes) ? minutes : 0;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatScore(exam: MockExam) {
  if (typeof exam.total_score === "number" && typeof exam.total_max === "number") {
    return `${exam.total_score} / ${exam.total_max}`;
  }
  return "未入力";
}

const loadingWrapStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "3px solid rgba(148,163,184,0.24)",
  borderTopColor: "#3157B7",
  animation: "spin 0.9s linear infinite",
};

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F8FAFC",
};

const mainStyle: CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "20px 16px 88px",
  display: "grid",
  gap: 16,
};

const heroCardStyle: CSSProperties = {
  borderRadius: 28,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 20,
  display: "grid",
  gap: 16,
};

const heroHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};

const avatarStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #0F172A 0%, #3157B7 100%)",
  display: "grid",
  placeItems: "center",
  color: "#FFFFFF",
  fontSize: 22,
  fontWeight: 900,
  flexShrink: 0,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const heroTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 26,
  lineHeight: 1.1,
  fontWeight: 900,
  color: "#0F172A",
};

const pillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const primaryPillStyle = (bg: string, color: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 800,
});

const secondaryPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "#F1F5F9",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
};

const settingsButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

const levelCardStyle = (bg: string): CSSProperties => ({
  borderRadius: 22,
  background: bg,
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 16,
});

const levelLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const levelValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 24,
  fontWeight: 900,
  color: "#0F172A",
};

const progressMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 700,
  color: "#64748B",
};

const progressTrackStyle: CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "rgba(255,255,255,0.7)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const statCardStyle: CSSProperties = {
  borderRadius: 22,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 16,
  display: "grid",
  gap: 8,
};

const statLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const statValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#0F172A",
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const sectionCardStyle: CSSProperties = {
  borderRadius: 24,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 18,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  color: "#0F172A",
};

const sectionDescStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.7,
  color: "#64748B",
};

const infoListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const infoRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderRadius: 16,
  background: "#F8FAFC",
  padding: "12px 14px",
};

const infoLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const infoValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
  textAlign: "right",
};

const quickGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const quickLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 18,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: "14px 12px",
  textDecoration: "none",
};

const quickIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const quickLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const examCardStyle: CSSProperties = {
  borderRadius: 18,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const examTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0F172A",
};

const examSubStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748B",
};

const examScoreStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0F172A",
};

const badgeListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 18,
  background: "#FFF7ED",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: "12px 14px",
};

const badgeEmojiStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "#FFFFFF",
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  flexShrink: 0,
};

const badgeTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const badgeDescStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.6,
  color: "#64748B",
};

const emptyStyle: CSSProperties = {
  borderRadius: 18,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: 18,
  fontSize: 13,
  lineHeight: 1.8,
  color: "#64748B",
  textAlign: "center",
};
