"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { CalendarDays, Clock3, Flame, MessageSquareText, Sparkles, Target, Trophy, CheckCircle2 } from "lucide-react";

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

type MockExam = {
  id: string;
  exam_name: string;
  exam_date: string;
  total_score: number | null;
  total_max: number | null;
  total_deviation: number | null;
};

export default function MePage() {
  const [profile, setProfile] = useState<XpData | null>(null);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/xp"), fetch("/api/badges"), fetch("/api/mock-exams")])
      .then(async ([xpRes, badgeRes, examRes]) => {
        const xpJson = xpRes.ok ? await xpRes.json() : null;
        const badgeJson = badgeRes.ok ? await badgeRes.json() : { badges: [] };
        const examJson = examRes.ok ? await examRes.json() : { exams: [] };
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
  const lockedBadges = badges.filter((badge) => !badge.unlocked);
  const remainingXp = Math.max(0, profile.next - profile.xp);
  const latestExam = exams[0] ?? null;
  const accent = profile.levelTheme?.accent ?? "#3157B7";
  const bg = profile.levelTheme?.bg ?? "#EEF2FF";

  return (
    <AppLayout>
      <div style={pageStyle}>
        <main style={mainStyle}>
          <section style={heroStyle}>
            <div style={avatarStyle}>{(profile.name || "?").slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={eyebrowStyle}>My profile</p>
              <h1 style={titleStyle}>{profile.name || "あなた"}</h1>
              <p style={subtitleStyle}>
                毎日の自習の積み上がりをまとめて見返せるページです。今の成長、勉強量、質問回数、最近の成績をひと目で確認できます。
              </p>
              <div style={tagRowStyle}>
                <span style={{ ...tagStyle, background: bg, color: accent }}>{profile.planLabel}</span>
                <span style={tagStyle}>Lv.{profile.level}</span>
                {profile.targetUniv ? <span style={tagStyle}>{profile.targetUniv}</span> : null}
              </div>
            </div>
          </section>

          <section style={statsGridStyle}>
            <StatCard icon={<Clock3 size={16} />} label="総勉強時間" value={formatStudyMinutes(profile.totalStudyMinutes)} helper="演習ログの合計" />
            <StatCard icon={<CheckCircle2 size={16} />} label="解いた問題" value={`${profile.totalSolvedProblems}問`} helper="記録済みの問題数" />
            <StatCard icon={<MessageSquareText size={16} />} label="質問回数" value={`${profile.totalQuestions}回`} helper="AIに相談した回数" />
            <StatCard icon={<CalendarDays size={16} />} label="活動日数" value={`${profile.activeStudyDays}日`} helper="学習した日数" />
          </section>

          <section style={twoColStyle}>
            <div style={cardStyle}>
              <SectionHead title="現在の成長" desc="今のレベルと継続状況をまとめています。" />
              <div style={growthHeroStyle(bg)}>
                <div>
                  <div style={growthLabelStyle}>現在レベル</div>
                  <div style={growthValueStyle}>Lv.{profile.level}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={growthLabelStyle}>次のレベルまで</div>
                  <div style={growthValueStyle}>{remainingXp} XP</div>
                </div>
              </div>
              <div style={progressTrackStyle}>
                <div style={{ ...progressFillStyle, width: `${profile.pct}%`, background: accent }} />
              </div>
              <div style={metaGridStyle}>
                <MetaCard icon={<Sparkles size={15} />} label="現在XP" value={`${profile.xp} XP`} />
                <MetaCard icon={<Flame size={15} />} label="連続日数" value={`${profile.streak}日`} />
                <MetaCard icon={<Trophy size={15} />} label="バッジ" value={`${profile.badgeCount}個`} />
                <MetaCard icon={<Target size={15} />} label="受験日" value={profile.examDate ? formatDate(profile.examDate) : "未設定"} />
              </div>
            </div>

            <div style={cardStyle}>
              <SectionHead title="最近の成績" desc="直近の模試や成績のメモを見返せます。" />
              {latestExam ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={examHeroStyle}>
                    <div>
                      <div style={examTitleStyle}>{latestExam.exam_name}</div>
                      <div style={examSubStyle}>{formatDate(latestExam.exam_date)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={examScoreStyle}>{formatScore(latestExam)}</div>
                      <div style={examSubStyle}>{latestExam.total_deviation ? `偏差値 ${latestExam.total_deviation}` : "偏差値未登録"}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {exams.slice(1, 4).map((exam) => (
                      <div key={exam.id} style={examRowStyle}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{exam.exam_name}</div>
                          <div style={examSubStyle}>{formatDate(exam.exam_date)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>{formatScore(exam)}</div>
                      </div>
                    ))}
                  </div>
                  <Link href="/progress" style={inlineLinkStyle}>課題・勉強履歴を開く</Link>
                </div>
              ) : (
                <div style={emptyStyle}>模試がまだ登録されていません。振り返りページから追加できます。</div>
              )}
            </div>
          </section>

          <section style={twoColStyle}>
            <div style={cardStyle}>
              <SectionHead title="解放したバッジ" desc="今までの積み上がりをバッジで確認できます。" />
              <div style={{ display: "grid", gap: 10 }}>
                {unlockedBadges.length > 0 ? (
                  unlockedBadges.slice(0, 6).map((badge) => (
                    <div key={badge.id} style={badgeRowStyle(true)}>
                      <div style={badgeEmojiStyle}>{badge.emoji}</div>
                      <div>
                        <div style={badgeTitleStyle}>{badge.label}</div>
                        <div style={badgeDescStyle}>{badge.description}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={emptyStyle}>まだ解放したバッジはありません。</div>
                )}
              </div>
              <Link href="/badges" style={inlineLinkStyle}>バッジ一覧を見る</Link>
            </div>

            <div style={cardStyle}>
              <SectionHead title="次に広がる要素" desc="これから解放される要素も見ながら前に進めます。" />
              <div style={{ display: "grid", gap: 10 }}>
                {lockedBadges.length > 0 ? (
                  lockedBadges.slice(0, 4).map((badge) => (
                    <div key={badge.id} style={badgeRowStyle(false)}>
                      <div style={badgeEmojiStyle}>{badge.emoji}</div>
                      <div>
                        <div style={badgeTitleStyle}>{badge.label}</div>
                        <div style={badgeDescStyle}>{badge.description}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={emptyStyle}>すべてのバッジを解放しました。</div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AppLayout>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: "#0F172A" }}>{title}</h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748B" }}>{desc}</p>
    </div>
  );
}

function StatCard({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{icon}{label}</div>
      <div style={statValueStyle}>{value}</div>
      <div style={statHelperStyle}>{helper}</div>
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={metaCardStyle}>
      <div style={metaLabelStyle}>{icon}{label}</div>
      <div style={metaValueStyle}>{value}</div>
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
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatScore(exam: MockExam) {
  if (typeof exam.total_score === "number" && typeof exam.total_max === "number") {
    return `${exam.total_score} / ${exam.total_max}`;
  }
  return "未入力";
}

const loadingWrapStyle: CSSProperties = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" };
const spinnerStyle: CSSProperties = { width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(148,163,184,0.24)", borderTopColor: "#3157B7", animation: "spin 0.9s linear infinite" };
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const mainStyle: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "24px 16px 80px", display: "grid", gap: 20 };
const heroStyle: CSSProperties = { display: "flex", alignItems: "start", gap: 18, borderRadius: 28, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", padding: 24 };
const avatarStyle: CSSProperties = { width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg, #0F172A 0%, #3157B7 100%)", display: "grid", placeItems: "center", color: "#FFFFFF", fontSize: 28, fontWeight: 900, flexShrink: 0 };
const eyebrowStyle: CSSProperties = { margin: 0, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800, color: "#5470D9" };
const titleStyle: CSSProperties = { margin: "8px 0 8px", fontSize: 34, lineHeight: 1.1, fontWeight: 900, color: "#0F172A" };
const subtitleStyle: CSSProperties = { margin: 0, maxWidth: 700, fontSize: 14, lineHeight: 1.8, color: "#64748B" };
const tagRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const tagStyle: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 34, padding: "0 12px", borderRadius: 999, background: "#F1F5F9", color: "#0F172A", fontSize: 12, fontWeight: 800 };
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 };
const statCardStyle: CSSProperties = { borderRadius: 22, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", padding: 18, display: "grid", gap: 8 };
const statLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#64748B" };
const statValueStyle: CSSProperties = { fontSize: 24, fontWeight: 900, color: "#0F172A" };
const statHelperStyle: CSSProperties = { fontSize: 12, color: "#94A3B8" };
const twoColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 };
const cardStyle: CSSProperties = { borderRadius: 28, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.14)", padding: 20 };
const growthHeroStyle = (bg: string): CSSProperties => ({ borderRadius: 24, background: bg, padding: 18, display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 });
const growthLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#64748B" };
const growthValueStyle: CSSProperties = { marginTop: 6, fontSize: 26, fontWeight: 900, color: "#0F172A" };
const progressTrackStyle: CSSProperties = { height: 8, borderRadius: 999, background: "#E2E8F0", overflow: "hidden", marginBottom: 14 };
const progressFillStyle: CSSProperties = { height: "100%", borderRadius: 999 };
const metaGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 };
const metaCardStyle: CSSProperties = { borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 14, display: "grid", gap: 8 };
const metaLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#64748B" };
const metaValueStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#0F172A" };
const examHeroStyle: CSSProperties = { borderRadius: 20, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 16, display: "flex", justifyContent: "space-between", gap: 12 };
const examTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 900, color: "#0F172A" };
const examScoreStyle: CSSProperties = { fontSize: 18, fontWeight: 900, color: "#0F172A" };
const examSubStyle: CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B" };
const examRowStyle: CSSProperties = { borderRadius: 18, background: "#FFFFFF", border: "1px solid rgba(148,163,184,0.12)", padding: 14, display: "flex", justifyContent: "space-between", gap: 12 };
const badgeRowStyle = (unlocked: boolean): CSSProperties => ({ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 18, background: unlocked ? "#FFF7ED" : "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", opacity: unlocked ? 1 : 0.75 });
const badgeEmojiStyle: CSSProperties = { width: 42, height: 42, borderRadius: 14, background: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 };
const badgeTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0F172A" };
const badgeDescStyle: CSSProperties = { marginTop: 4, fontSize: 12, lineHeight: 1.6, color: "#64748B" };
const inlineLinkStyle: CSSProperties = { marginTop: 12, display: "inline-flex", fontSize: 13, fontWeight: 800, color: "#3157B7" };
const emptyStyle: CSSProperties = { borderRadius: 20, background: "#F8FAFC", border: "1px solid rgba(148,163,184,0.12)", padding: 20, fontSize: 13, lineHeight: 1.8, color: "#64748B", textAlign: "center" };

