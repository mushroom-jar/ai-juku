"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { getPlanDisplayName, type BillingInterval, type StudentPlan } from "@/lib/plans";
import { SUBJECT_LABEL } from "@/lib/types";

type StudentData = {
  id: string;
  name: string;
  grade: string;
  target_univ: string | null;
  exam_date: string | null;
  subjects: string[];
  plan: StudentPlan;
  billing_interval: BillingInterval;
  ai_support_trial_used: boolean;
  ai_juku_trial_used: boolean;
  study_style?: string | null;
  available_study_time?: {
    weekday_minutes?: number;
    holiday_minutes?: number;
  } | null;
  biggest_blocker?: string | null;
  strength_subjects?: string[];
  weakness_subjects?: string[];
  onboarding_summary?: string;
  ai_interview_completed_at?: string | null;
};

const GRADE_OPTIONS = [
  { value: "1", label: "高校1年" },
  { value: "2", label: "高校2年" },
  { value: "3", label: "高校3年" },
  { value: "4", label: "既卒" },
];

const STYLE_LABEL: Record<string, string> = {
  planner: "計画型",
  steady: "コツコツ型",
  sprinter: "追い込み型",
  mood: "波がある型",
};

const BLOCKER_LABEL: Record<string, string> = {
  start: "始めるまでが重い",
  continue: "途中で止まりやすい",
  questions: "分からない問題で止まりやすい",
  schedule: "何をやるか迷いやすい",
};

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  const [student, setStudent] = useState<StudentData | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("3");
  const [targetUniv, setTargetUniv] = useState("");
  const [examDate, setExamDate] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data) => {
        if (!data.student) return;
        setStudent(data.student);
        setEmail(data.email ?? "");
        setName(data.student.name ?? "");
        setGrade(String(data.student.grade ?? "3"));
        setTargetUniv(data.student.target_univ ?? "");
        setExamDate(data.student.exam_date ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        grade,
        target_univ: targetUniv || null,
        exam_date: examDate || null,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "保存に失敗しました。");
  }

  async function handleManagePlan() {
    if (!student) return;

    if (student.plan === "free") {
      router.push("/billing");
      return;
    }

    setBillingLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    setBillingLoading(false);
    setError(data.error ?? "プラン管理ページを開けませんでした。");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

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
        <div style={containerStyle}>
          {upgraded ? (
            <div style={successStyle}>
              プラン変更が反映されました。ここからプロフィールや学習方針を整えられます。
            </div>
          ) : null}

          <section style={cardStyle}>
            <p style={sectionEyebrowStyle}>Account</p>
            <h1 style={headingStyle}>設定</h1>
            <p style={subtleStyle}>
              プロフィール、学習方針、プラン情報をここで確認できます。
            </p>

            <div style={infoGridStyle}>
              <InfoBlock label="メールアドレス" value={email || "-"} />
              <InfoBlock
                label="現在のプラン"
                value={
                  student
                    ? `${getPlanDisplayName(student.plan)}${
                        student.plan === "free" ? "" : ` / ${student.billing_interval === "yearly" ? "年払い" : "月払い"}`
                      }`
                    : "-"
                }
              />
              <InfoBlock
                label="使用教科"
                value={(student?.subjects ?? []).map((subject) => SUBJECT_LABEL[subject] ?? subject).join(" / ") || "-"}
              />
            </div>

            <button onClick={handleManagePlan} disabled={billingLoading} style={primaryButtonStyle}>
              {billingLoading ? "読み込み中..." : student?.plan === "free" ? "プランを見る" : "プランを管理する"}
            </button>
          </section>

          <section style={cardStyle}>
            <p style={sectionEyebrowStyle}>AI Interview</p>
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 18,
                background: "#F8FAFF",
                border: "1px solid #E4E7EC",
                marginBottom: 16,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#101828" }}>
                AI面談をやり直す
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.7, color: "#667085" }}>
                最初の作戦会議をもう一度行って、学習タイプや勉強の進め方を更新できます。
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid #C7D7FE",
                  background: "#EEF4FF",
                  color: "#1D4ED8",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                AI面談へ進む
              </button>
            </div>

            <div style={infoGridStyle}>
              <InfoBlock label="学習タイプ" value={student?.study_style ? STYLE_LABEL[student.study_style] ?? student.study_style : "未設定"} />
              <InfoBlock
                label="止まりやすい点"
                value={student?.biggest_blocker ? BLOCKER_LABEL[student.biggest_blocker] ?? student.biggest_blocker : "未設定"}
              />
              <InfoBlock
                label="勉強時間"
                value={
                  student?.available_study_time
                    ? `平日 ${student.available_study_time.weekday_minutes ?? 0} 分 / 休日 ${student.available_study_time.holiday_minutes ?? 0} 分`
                    : "未設定"
                }
              />
            </div>

            {student?.onboarding_summary ? (
              <div style={summaryBoxStyle}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  面談メモ
                </p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.75, color: "#475467" }}>
                  {student.onboarding_summary}
                </p>
              </div>
            ) : null}
          </section>

          <section style={cardStyle}>
            <p style={sectionEyebrowStyle}>Profile</p>
            <div style={formGridStyle}>
              <Field label="名前">
                <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} placeholder="山田 太郎" />
              </Field>
              <Field label="学年">
                <select value={grade} onChange={(event) => setGrade(event.target.value)} style={inputStyle}>
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="志望校">
                <input value={targetUniv} onChange={(event) => setTargetUniv(event.target.value)} style={inputStyle} placeholder="東京大学" />
              </Field>
              <Field label="受験日">
                <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} style={inputStyle} />
              </Field>
            </div>

            {error ? <p style={errorTextStyle}>{error}</p> : null}

            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
              {saving ? "保存中..." : saved ? "保存しました" : "プロフィールを保存"}
            </button>
          </section>

          <section style={dangerCardStyle}>
            <div>
              <p style={sectionEyebrowStyle}>Session</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#667085" }}>
                この端末でのログインを終了します。
              </p>
            </div>
            <button onClick={handleLogout} style={dangerButtonStyle}>
              ログアウト
            </button>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <p style={infoLabelStyle}>{label}</p>
      <p style={infoValueStyle}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F3F5FA",
  padding: "28px 16px 40px",
};

const containerStyle: CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const loadingWrapStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "3px solid #D0D5DD",
  borderTopColor: "#3B52B4",
  animation: "spin 0.8s linear infinite",
};

const successStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#ECFDF3",
  border: "1px solid #ABEFC6",
  color: "#067647",
  fontSize: 14,
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  padding: 22,
  borderRadius: 24,
  background: "#FFFFFF",
  border: "1px solid #E4E7EC",
  boxShadow: "0 12px 32px rgba(16, 24, 40, 0.06)",
};

const dangerCardStyle: CSSProperties = {
  ...cardStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const sectionEyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#667085",
};

const headingStyle: CSSProperties = {
  margin: "8px 0 8px",
  fontSize: 28,
  fontWeight: 800,
  color: "#101828",
};

const subtleStyle: CSSProperties = {
  margin: "0 0 18px",
  fontSize: 14,
  lineHeight: 1.7,
  color: "#667085",
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  marginBottom: 18,
};

const infoBlockStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#F8FAFC",
  border: "1px solid #E4E7EC",
};

const infoLabelStyle: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 12,
  fontWeight: 700,
  color: "#667085",
};

const infoValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: "#101828",
};

const summaryBoxStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "#F8FAFC",
  border: "1px solid #E4E7EC",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginBottom: 16,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#344054",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #D0D5DD",
  background: "#FFFFFF",
  color: "#101828",
  fontSize: 14,
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #3655C6, #5C75DA)",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid #F04438",
  background: "transparent",
  color: "#D92D20",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  flexShrink: 0,
};

const errorTextStyle: CSSProperties = {
  margin: "0 0 12px",
  color: "#B42318",
  fontSize: 14,
  fontWeight: 600,
};
