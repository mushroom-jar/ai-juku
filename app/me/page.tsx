"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  MessageSquareText,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";

type LevelTheme = {
  accent: string;
  bg: string;
};

type XpData = {
  xp: number;
  name: string;
  level: number;
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

  const latestExam = exams[0] ?? null;
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const remainingXp = Math.max(0, profile.next - profile.xp);
  const accent = profile.levelTheme?.accent ?? "#3157B7";
  const softBg = profile.levelTheme?.bg ?? "#EEF2FF";

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>
          <section style={heroCardStyle}>
            <div style={heroTopStyle}>
              <div style={avatarStyle}>{(profile.name || "?").slice(0, 1).toUpperCase()}</div>
              <button onClick={() => router.push("/settings")} style={settingsButtonStyle}>
                <Settings size={15} />
                設定
              </button>
            </div>

            <div>
              <div style={eyebrowStyle}>マイページ</div>
              <h1 style={titleStyle}>{profile.name || "ユーザー"}</h1>
              <div style={pillRowStyle}>
                <span style={primaryPillStyle(softBg, accent)}>{profile.planLabel}</span>
                <span style={secondaryPillStyle}>Lv.{profile.level}</span>
              </div>
            </div>

            <div style={xpBoxStyle(softBg)}>
              <div style={xpTopStyle}>
                <span style={xpLabelStyle}>次のレベルまで</span>
                <span style={xpValueStyle}>{remainingXp} XP</span>
              </div>
              <div style={progressTrackStyle}>
                <div style={{ ...progressFillStyle, width: `${profile.pct}%`, background: accent }} />
              </div>
            </div>
          </section>

          <section style={statsGridStyle}>
            <SimpleStatCard icon={<Clock3 size={15} />} label="勉強時間" value={formatStudyMinutes(profile.totalStudyMinutes)} />
            <SimpleStatCard icon={<CheckCircle2 size={15} />} label="解いた問題" value={`${profile.totalSolvedProblems}問`} />
            <SimpleStatCard icon={<MessageSquareText size={15} />} label="質問回数" value={`${profile.totalQuestions}回`} />
            <SimpleStatCard icon={<Flame size={15} />} label="連続日数" value={`${profile.streak}日`} />
          </section>

          <section style={cardStyle}>
            <SectionHead title="プロフィール" />
            <div style={infoListStyle}>
              <InfoRow label="志望校" value={profile.targetUniv || "未設定"} />
              <InfoRow label="受験日" value={profile.examDate ? formatDate(profile.examDate) : "未設定"} />
              <InfoRow label="活動日数" value={`${profile.activeStudyDays}日`} />
              <InfoRow label="完了タスク" value={`${profile.completedTasks}件`} />
              <InfoRow label="バッジ" value={`${profile.badgeCount}個`} />
            </div>
          </section>

          <section style={cardStyle}>
            <SectionHead title="よく使う項目" />
            <div style={shortcutListStyle}>
              {QUICK_LINKS.map(({ href, label, Icon, color, bg }) => (
                <Link key={href} href={href} style={shortcutRowStyle}>
                  <div style={{ ...shortcutIconStyle, color, background: bg }}>
                    <Icon size={18} />
                  </div>
                  <span style={shortcutLabelStyle}>{label}</span>
                  <ChevronRight size={16} color="#94A3B8" />
                </Link>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <SectionHead title="最近の成績" />
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
          </section>

          <section style={cardStyle}>
            <SectionHead title="最近のバッジ" />
            {unlockedBadges.length > 0 ? (
              <div style={badgeListStyle}>
                {unlockedBadges.slice(0, 3).map((badge) => (
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
          </section>
        </main>
      </div>
    </AppLayout>
  );
}

function SectionHead({ title }: { title: string }) {
  return <h2 style={sectionTitleStyle}>{title}</h2>;
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
  maxWidth: 560,
  margin: "0 auto",
  padding: "14px 12px 88px",
  display: "grid",
  gap: 12,
};

const heroCardStyle: CSSProperties = {
  borderRadius: 22,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 14,
  display: "grid",
  gap: 14,
};

const heroTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const avatarStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #0F172A 0%, #3157B7 100%)",
  display: "grid",
  placeItems: "center",
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: 900,
  flexShrink: 0,
};

const settingsButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748B",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 900,
  color: "#0F172A",
};

const pillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 10,
};

const primaryPillStyle = (bg: string, color: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 800,
});

const secondaryPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#F1F5F9",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
};

const xpBoxStyle = (bg: string): CSSProperties => ({
  borderRadius: 18,
  background: bg,
  padding: 14,
  display: "grid",
  gap: 8,
});

const xpTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const xpLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
};

const xpValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0F172A",
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const statCardStyle: CSSProperties = {
  borderRadius: 18,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 14,
  display: "grid",
  gap: 6,
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
  fontSize: 18,
  fontWeight: 900,
  color: "#0F172A",
};

const cardStyle: CSSProperties = {
  borderRadius: 20,
  background: "#FFFFFF",
  border: "1px solid rgba(148,163,184,0.14)",
  padding: 14,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  fontWeight: 900,
  color: "#0F172A",
};

const infoListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const infoRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderRadius: 14,
  background: "#F8FAFC",
  padding: "10px 12px",
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

const shortcutListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const shortcutRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 14,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: "11px 12px",
  textDecoration: "none",
};

const shortcutIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const shortcutLabelStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const examCardStyle: CSSProperties = {
  borderRadius: 16,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const examTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0F172A",
};

const examSubStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748B",
};

const examScoreStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0F172A",
};

const badgeListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 14,
  background: "#FFF7ED",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: "10px 12px",
};

const badgeEmojiStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: "#FFFFFF",
  display: "grid",
  placeItems: "center",
  fontSize: 17,
  flexShrink: 0,
};

const badgeTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const badgeDescStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  lineHeight: 1.5,
  color: "#64748B",
};

const emptyStyle: CSSProperties = {
  borderRadius: 14,
  background: "#F8FAFC",
  border: "1px solid rgba(148,163,184,0.12)",
  padding: 16,
  fontSize: 13,
  lineHeight: 1.7,
  color: "#64748B",
  textAlign: "center",
};
