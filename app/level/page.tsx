import { redirect } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { createClient } from "@/lib/supabase/server";
import { LEVEL_THEMES, XP_LEVELS, calcLevel } from "@/lib/levels";
import { Lock, Unlock, CheckCheck, Zap, Flame, Star } from "lucide-react";
import type { CSSProperties } from "react";

function alpha(hex: string, opacity: number) {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map(x => x + x).join("") : c;
  const v = parseInt(n, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${opacity})`;
}

export default async function LevelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("xp, name")
    .eq("user_id", user.id)
    .single();

  const xp = student?.xp ?? 0;
  const { level, pct } = calcLevel(xp);

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={containerStyle}>

          {/* ヒーローカード */}
          <div style={heroStyle(LEVEL_THEMES[level - 1].accent, LEVEL_THEMES[level - 1].bg)}>
            <div style={heroLeftStyle}>
              <div style={heroEyebrowStyle}>現在のレベル</div>
              <div style={heroLevelStyle}>Lv.{level}</div>
              <div style={heroTitleStyle}>{LEVEL_THEMES[level - 1].title}</div>
              <div style={heroSubStyle}>{LEVEL_THEMES[level - 1].subtitle}</div>
            </div>
            <div style={heroRightStyle}>
              <div style={heroXpStyle}>
                <Zap size={16} color={LEVEL_THEMES[level - 1].accent} />
                <span style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{xp.toLocaleString()}</span>
                <span style={{ fontSize: 13, color: "#64748B", fontWeight: 700 }}>XP</span>
              </div>
              <div style={progressTrackStyle}>
                <div style={progressFillStyle(pct, LEVEL_THEMES[level - 1].accent)} />
              </div>
              {level < 10 && (
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textAlign: "right" }}>
                  Lv.{level + 1} まで {Math.max(0, (XP_LEVELS[level] ?? 0) - xp).toLocaleString()} XP
                </div>
              )}
            </div>
          </div>

          {/* レベルロードマップ */}
          <div style={roadmapLabelStyle}>
            <Star size={14} color="#B45309" />
            レベルロードマップ
          </div>

          <div style={roadmapStyle}>
            {LEVEL_THEMES.map((theme, i) => {
              const lv = theme.level;
              const isCompleted = lv < level;
              const isCurrent = lv === level;
              const isLocked = lv > level;
              const xpStart = XP_LEVELS[i] ?? 0;
              const xpEnd = XP_LEVELS[i + 1];

              return (
                <div key={lv} style={levelCardStyle(isCurrent, theme.accent)}>
                  {/* 左：バッジ */}
                  <div style={badgeColStyle}>
                    <div style={badgeStyle(isCompleted, isCurrent, theme.accent, theme.bg)}>
                      {isCompleted
                        ? <CheckCheck size={18} strokeWidth={2.5} />
                        : isLocked
                          ? <Lock size={16} strokeWidth={2.3} />
                          : <span style={{ fontSize: 15, fontWeight: 900 }}>{lv}</span>
                      }
                    </div>
                    {i < LEVEL_THEMES.length - 1 && (
                      <div style={connectorStyle(isCompleted)} />
                    )}
                  </div>

                  {/* 右：内容 */}
                  <div style={cardBodyStyle}>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={cardLevelTagStyle(isCurrent, theme.accent)}>
                          Lv.{lv}
                          {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: theme.accent, color: "#fff", padding: "2px 6px", borderRadius: 999 }}>現在</span>}
                        </div>
                        <div style={cardTitleStyle(isLocked)}>{theme.title}</div>
                        <div style={cardXpStyle}>
                          {xpEnd
                            ? `${xpStart.toLocaleString()} 〜 ${(xpEnd - 1).toLocaleString()} XP`
                            : `${xpStart.toLocaleString()} XP 〜`}
                        </div>
                      </div>
                      {isCompleted && (
                        <div style={completedBadgeStyle}>
                          <CheckCheck size={12} strokeWidth={2.5} />
                          達成済み
                        </div>
                      )}
                    </div>

                    <div style={unlockListStyle}>
                      {theme.unlocks.map(item => (
                        <div key={item} style={unlockItemStyle(isLocked, isCompleted, theme.accent)}>
                          {isLocked
                            ? <Lock size={11} style={{ flexShrink: 0 }} />
                            : <Unlock size={11} color={isCompleted ? "#64748B" : theme.accent} style={{ flexShrink: 0 }} />
                          }
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrent && (
                      <div style={currentProgressStyle(theme.accent)}>
                        <Flame size={13} color={theme.accent} />
                        <span>現在 {xp.toLocaleString()} XP — 次のレベルまであと {Math.max(0, (XP_LEVELS[lv] ?? 0) - xp).toLocaleString()} XP</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* XP獲得方法 */}
          <div style={earnCardStyle}>
            <div style={earnTitleStyle}>XPの増やし方</div>
            <div style={earnGridStyle}>
              {[
                { label: "タスク完了", xp: "+10 XP", desc: "スケジュールのタスクを1件こなすたびに" },
                { label: "問題を記録", xp: "+1〜3 XP", desc: "演習記録1問ごと（完璧正解は+3）" },
                { label: "模試を登録", xp: "+15 XP", desc: "模試の結果を入力するたびに" },
              ].map(item => (
                <div key={item.label} style={earnItemStyle}>
                  <div style={earnXpStyle}>{item.xp}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginTop: 4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

const pageStyle: CSSProperties = { padding: "28px 16px 48px", minHeight: "100dvh" };
const containerStyle: CSSProperties = { maxWidth: 720, margin: "0 auto", display: "grid", gap: 20 };

const heroStyle = (accent: string, bg: string): CSSProperties => ({
  borderRadius: 24,
  padding: "24px 28px",
  background: `linear-gradient(145deg, ${bg} 0%, #FFFFFF 100%)`,
  border: `1px solid ${alpha(accent, 0.18)}`,
  boxShadow: `0 16px 40px ${alpha(accent, 0.10)}`,
  display: "flex",
  alignItems: "center",
  gap: 24,
  flexWrap: "wrap",
});
const heroLeftStyle: CSSProperties = { flex: "0 0 auto", minWidth: 160 };
const heroEyebrowStyle: CSSProperties = { fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" };
const heroLevelStyle: CSSProperties = { fontSize: 48, fontWeight: 900, lineHeight: 1.1, color: "#0F172A", letterSpacing: "-0.04em" };
const heroTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 4 };
const heroSubStyle: CSSProperties = { fontSize: 12, color: "#64748B", marginTop: 2 };
const heroRightStyle: CSSProperties = { flex: 1, minWidth: 200, display: "grid", gap: 8 };
const heroXpStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const progressTrackStyle: CSSProperties = { height: 10, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" };
const progressFillStyle = (pct: number, accent: string): CSSProperties => ({
  height: "100%", width: `${pct}%`, background: accent,
  borderRadius: 999, transition: "width 0.6s ease",
});

const roadmapLabelStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 7,
  fontSize: 12, fontWeight: 800, color: "#B45309",
  textTransform: "uppercase", letterSpacing: "0.08em",
  paddingLeft: 4,
};

const roadmapStyle: CSSProperties = { display: "flex", flexDirection: "column" };

const levelCardStyle = (isCurrent: boolean, accent: string): CSSProperties => ({
  display: "flex", gap: 0,
  background: isCurrent ? "rgba(255,255,255,0.9)" : "transparent",
  border: isCurrent ? `1.5px solid ${alpha(accent, 0.22)}` : "1.5px solid transparent",
  borderRadius: 20,
  boxShadow: isCurrent ? `0 8px 24px ${alpha(accent, 0.10)}` : "none",
  padding: isCurrent ? "4px 0" : 0,
  marginBottom: 0,
  transition: "all 0.2s ease",
});

const badgeColStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", width: 56, flexShrink: 0 };

const badgeStyle = (done: boolean, current: boolean, accent: string, bg: string): CSSProperties => ({
  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  marginTop: 16,
  background: done ? "#F0FDF4" : current ? `linear-gradient(135deg, ${accent}, #4F7BFF)` : "#F1F5F9",
  color: done ? "#16A34A" : current ? "#fff" : "#94A3B8",
  border: done ? "1.5px solid #86EFAC" : current ? "none" : "1.5px solid #E2E8F0",
  boxShadow: current ? `0 6px 16px ${alpha(accent, 0.30)}` : "none",
  fontSize: 14, fontWeight: 900,
});

const connectorStyle = (done: boolean): CSSProperties => ({
  width: 2, flex: 1, minHeight: 16,
  background: done ? "#86EFAC" : "#E2E8F0",
  borderRadius: 999, margin: "4px 0",
});

const cardBodyStyle: CSSProperties = { flex: 1, padding: "16px 16px 16px 0" };
const cardHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 };
const cardLevelTagStyle = (current: boolean, accent: string): CSSProperties => ({
  fontSize: 11, fontWeight: 800, color: current ? accent : "#94A3B8",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
  display: "flex", alignItems: "center",
});
const cardTitleStyle = (locked: boolean): CSSProperties => ({
  fontSize: 16, fontWeight: 900, color: locked ? "#94A3B8" : "#0F172A", letterSpacing: "-0.02em",
});
const cardXpStyle: CSSProperties = { fontSize: 11, color: "#94A3B8", fontWeight: 700, marginTop: 3 };
const completedBadgeStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "4px 10px", borderRadius: 999,
  background: "#F0FDF4", border: "1px solid #86EFAC",
  color: "#16A34A", fontSize: 11, fontWeight: 800, flexShrink: 0,
};

const unlockListStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 };
const unlockItemStyle = (locked: boolean, done: boolean, accent: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 10px", borderRadius: 999,
  background: locked ? "#F8FAFC" : done ? "#F8FAFC" : alpha(accent, 0.08),
  border: `1px solid ${locked ? "#E2E8F0" : done ? "#E2E8F0" : alpha(accent, 0.18)}`,
  fontSize: 11, fontWeight: 700,
  color: locked ? "#94A3B8" : done ? "#64748B" : "#0F172A",
});

const currentProgressStyle = (accent: string): CSSProperties => ({
  marginTop: 12, display: "flex", alignItems: "center", gap: 6,
  padding: "9px 12px", borderRadius: 12,
  background: alpha(accent, 0.06), border: `1px solid ${alpha(accent, 0.14)}`,
  fontSize: 12, fontWeight: 700, color: "#0F172A",
});

const earnCardStyle: CSSProperties = {
  borderRadius: 20, padding: "20px 22px",
  background: "#FFFFFF", border: "1px solid #E4E7EC",
  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
};
const earnTitleStyle: CSSProperties = {
  fontSize: 13, fontWeight: 800, color: "#64748B",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14,
};
const earnGridStyle: CSSProperties = {
  display: "grid", gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};
const earnItemStyle: CSSProperties = {
  padding: "14px 16px", borderRadius: 14,
  background: "#F8FAFC", border: "1px solid #E4E7EC",
};
const earnXpStyle: CSSProperties = {
  fontSize: 20, fontWeight: 900, color: "#3157B7",
  letterSpacing: "-0.03em", marginBottom: 6,
};
