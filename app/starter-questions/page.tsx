"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type GoalStatus = "decided" | "rough" | "undecided";

const GRADE_OPTIONS = [
  "中1", "中2", "中3",
  "高1", "高2", "高3", "既卒",
];

const GOAL_OPTIONS: Array<{ value: GoalStatus; label: string; desc: string }> = [
  { value: "decided",   label: "決まっている",   desc: "具体的な志望校がある" },
  { value: "rough",     label: "なんとなくある", desc: "だいたいの方向はある" },
  { value: "undecided", label: "まだ未定",        desc: "これから考えていく" },
];

const SUBJECT_OPTIONS = [
  "英語", "数学", "国語", "理科", "社会", "情報", "まだ分からない",
];

export default function StarterQuestionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [grade, setGrade]         = useState("");
  const [goalStatus, setGoalStatus] = useState<GoalStatus | "">("");
  const [targetName, setTargetName] = useState("");
  const [worrySubject, setWorrySubject] = useState("");
  const [saving, setSaving]       = useState(false);
  const [syncingPlan, setSyncingPlan] = useState(Boolean(sessionId));
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const res = await fetch("/api/billing/confirm-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (cancelled) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "購入内容の反映に失敗しました。");
      }

      setSyncingPlan(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  function nextFromStep1() {
    if (!grade) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextFromStep2() {
    if (!goalStatus) return;
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleFinish() {
    if (!worrySubject || saving) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/starter-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gradeLabel:    grade,
        goalStatus:    goalStatus as GoalStatus,
        targetName:    targetName.trim() || undefined,
        worrySubject,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "保存に失敗しました。");
      setSaving(false);
      return;
    }

    router.push("/schedule");
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={wrapStyle}>
        {syncingPlan && (
          <div style={syncCardStyle}>
            <p style={syncTitleStyle}>購入内容を反映しています</p>
            <p style={syncTextStyle}>数秒で終わります。このままお待ちください。</p>
          </div>
        )}

        {/* ── ステップインジケーター ── */}
        <div style={stepBarWrapStyle}>
          {([1, 2, 3] as const).map((n) => (
            <div
              key={n}
              style={{
                ...stepDotStyle,
                background: step === n ? "#3157B7" : step > n ? "#3157B7" : "#E2E8F0",
                opacity: step > n ? 0.4 : 1,
              }}
            />
          ))}
        </div>
        <p style={stepLabelStyle}>{step} / 3</p>

        {/* ── ヘッドライン ── */}
        <div style={headlineBoxStyle}>
          <p style={eyebrowStyle}>Setup</p>
          <h1 style={titleStyle}>はじめに3つだけ教えてください</h1>
          <p style={subStyle}>最初のホームをあなた向けに整えます。30秒で終わります。</p>
        </div>

        {/* ───────────── STEP 1: 学年 ───────────── */}
        {step === 1 && (
          <div style={cardStyle}>
            <p style={questionStyle}>今の学年を教えてください</p>
            <div style={chipGridStyle}>
              {GRADE_OPTIONS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  style={chipStyle(grade === g)}
                >
                  {grade === g && <CheckCircle2 size={13} color="#3157B7" style={{ flexShrink: 0 }} />}
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={nextFromStep1}
              disabled={!grade}
              style={nextBtnStyle(!grade)}
            >
              次へ <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ───────────── STEP 2: 志望校 ───────────── */}
        {step === 2 && (
          <div style={cardStyle}>
            <p style={questionStyle}>志望校は決まっていますか？</p>
            <div style={goalGridStyle}>
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGoalStatus(opt.value)}
                  style={goalChipStyle(goalStatus === opt.value)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {goalStatus === opt.value && <CheckCircle2 size={14} color="#3157B7" style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: 14, fontWeight: 800, color: goalStatus === opt.value ? "#1E3A8A" : "#0F172A" }}>
                      {opt.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            {goalStatus === "decided" && (
              <div style={targetInputWrapStyle}>
                <label style={targetLabelStyle}>志望校・志望大学の名前（任意）</label>
                <input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="例：東京大学、早稲田大学"
                  style={targetInputStyle}
                />
              </div>
            )}

            <button
              onClick={nextFromStep2}
              disabled={!goalStatus}
              style={nextBtnStyle(!goalStatus)}
            >
              次へ <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ───────────── STEP 3: 不安な科目 ───────────── */}
        {step === 3 && (
          <div style={cardStyle}>
            <p style={questionStyle}>今いちばん不安な科目は？</p>
            <div style={chipGridStyle}>
              {SUBJECT_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setWorrySubject(s)}
                  style={chipStyle(worrySubject === s)}
                >
                  {worrySubject === s && <CheckCircle2 size={13} color="#3157B7" style={{ flexShrink: 0 }} />}
                  {s}
                </button>
              ))}
            </div>

            {error && <p style={errorStyle}>{error}</p>}

            <button
              onClick={() => void handleFinish()}
              disabled={!worrySubject || saving}
              style={finishBtnStyle(!worrySubject || saving)}
            >
              {saving ? "準備中..." : "ホームへ進む"}
              {!saving && <ArrowRight size={15} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── スタイル ──────────────────────────────────────────────────
const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F7F7F5",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "40px 20px 60px",
};

const logoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 32,
  color: "inherit",
  textDecoration: "none",
};

const logoBadgeStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: "#1E293B",
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
};

const logoTextStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#1E293B",
};

const wrapStyle: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  display: "grid",
  gap: 0,
};

const stepBarWrapStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  marginBottom: 6,
};

const stepDotStyle: CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 999,
  transition: "background 0.2s",
};

const stepLabelStyle: CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "#94A3B8",
  margin: "0 0 20px",
};

const headlineBoxStyle: CSSProperties = {
  textAlign: "center",
  marginBottom: 20,
  display: "grid",
  gap: 6,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#3157B7",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0F172A",
};

const subStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.7,
};

const cardStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 20,
  border: "1px solid #E8E8E4",
  padding: "24px 24px 20px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.05)",
  display: "grid",
  gap: 16,
};

const questionStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#0F172A",
  letterSpacing: "-0.02em",
};

const chipGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const chipStyle = (selected: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  borderRadius: 999,
  border: selected ? "2px solid #3157B7" : "1px solid #E2E8F0",
  background: selected ? "#EFF6FF" : "#FAFAFA",
  color: selected ? "#1E40AF" : "#334155",
  fontSize: 14,
  fontWeight: selected ? 800 : 600,
  cursor: "pointer",
  transition: "all 0.15s",
});

const goalGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const goalChipStyle = (selected: boolean): CSSProperties => ({
  padding: "14px 16px",
  borderRadius: 14,
  border: selected ? "2px solid #3157B7" : "1px solid #E2E8F0",
  background: selected ? "#EFF6FF" : "#FAFAFA",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  transition: "all 0.15s",
});

const targetInputWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const targetLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const targetInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  background: "#FAFAFA",
  padding: "0 14px",
  fontSize: 14,
  color: "#0F172A",
  boxSizing: "border-box",
};

const nextBtnStyle = (disabled: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #3157B7, #5E78DA)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: disabled ? "default" : "pointer",
  transition: "background 0.15s",
});

const finishBtnStyle = (disabled: boolean): CSSProperties => ({
  ...nextBtnStyle(disabled),
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #3157B7, #5E78DA)",
});

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#DC2626",
  fontSize: 13,
  fontWeight: 700,
};

const syncCardStyle: CSSProperties = {
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  borderRadius: 16,
  padding: "14px 16px",
  marginBottom: 16,
  display: "grid",
  gap: 4,
};

const syncTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  color: "#1D4ED8",
};

const syncTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.6,
};
