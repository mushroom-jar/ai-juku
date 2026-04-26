"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { getPlanDisplayName, type BillingInterval, type StudentPlan } from "@/lib/plans";
import { subscribeToPush, unsubscribeFromPush } from "@/app/components/PwaRegister";

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
  available_study_time?: { weekday_minutes?: number; holiday_minutes?: number } | null;
  biggest_blocker?: string | null;
  onboarding_summary?: string;
  ai_interview_completed_at?: string | null;
  sensei_personality?: string | null;
  payment_token?: string | null;
  premium_until?: string | null;
  stripe_subscription_id?: string | null;
  plan_source?: string | null;
};

const GRADE_OPTIONS = [
  { value: "1", label: "高校1年" },
  { value: "2", label: "高校2年" },
  { value: "3", label: "高校3年" },
  { value: "4", label: "既卒" },
];

const PERSONALITY_OPTIONS = [
  { key: "balanced", label: "バランス型", desc: "やさしく、でも前に進む" },
  { key: "strict",   label: "厳しめ",    desc: "妥協せず引っ張る" },
  { key: "friendly", label: "友達感覚",  desc: "カジュアルに考える" },
] as const;

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  const [student, setStudent] = useState<StudentData | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  // Profile
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("3");
  const [targetUniv, setTargetUniv] = useState("");
  const [examDate, setExamDate] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Personality
  const [personality, setPersonality] = useState<"balanced" | "strict" | "friendly">("balanced");
  const [personalitySaving, setPersonalitySaving] = useState(false);

  // Push
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [morningTime, setMorningTime] = useState("07:00");
  const [eveningEnabled, setEveningEnabled] = useState(false);
  const [eveningTime, setEveningTime] = useState("21:00");
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // 招待コード入力（登録後に使用）
  const [inviteInput, setInviteInput] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "valid" | "invalid" | "applying" | "applied">("idle");
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready
        .then((r) => r.pushManager.getSubscription())
        .then((s) => setPushEnabled(!!s))
        .catch(() => {});
    }

    fetch("/api/push/prefs")
      .then((r) => r.json())
      .then((d: { prefs?: { morning_enabled: boolean; morning_time: string; evening_enabled: boolean; evening_time: string } }) => {
        if (d.prefs) {
          setMorningEnabled(d.prefs.morning_enabled ?? false);
          setMorningTime(d.prefs.morning_time ?? "07:00");
          setEveningEnabled(d.prefs.evening_enabled ?? false);
          setEveningTime(d.prefs.evening_time ?? "21:00");
        }
      })
      .catch(() => {});

    fetch("/api/referral")
      .then((r) => r.json())
      .then((d: { code?: string }) => { if (d.code) setReferralCode(d.code); })
      .catch(() => {});

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.student) return;
        setStudent(d.student);
        setEmail(d.email ?? "");
        setName(d.student.name ?? "");
        setPersonality((d.student.sensei_personality as "balanced" | "strict" | "friendly") ?? "balanced");
        setGrade(String(d.student.grade ?? "3"));
        setTargetUniv(d.student.target_univ ?? "");
        setExamDate(d.student.exam_date ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grade, target_univ: targetUniv || null, exam_date: examDate || null }),
    });
    setProfileSaving(false);
    if (res.ok) { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); }
    else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setProfileError(d.error ?? "保存に失敗しました。");
    }
  }

  async function handleSavePersonality() {
    setPersonalitySaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensei_personality: personality }),
    });
    setPersonalitySaving(false);
  }

  async function handleManagePlan() {
    setBillingError("");
    if (!student || student.plan === "free" || !student.stripe_subscription_id) {
      router.push("/billing");
      return;
    }
    setBillingLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const d = await res.json().catch(() => ({})) as { url?: string; error?: string };
    if (d.url) { window.location.href = d.url; return; }
    setBillingLoading(false);
    if (d.error === "no customer") { router.push("/billing"); return; }
    setBillingError(d.error ?? "請求ポータルへの接続に失敗しました。");
  }

  async function handleTogglePush() {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        setPushEnabled(false);
      } else {
        const sub = await subscribeToPush();
        if (sub) {
          const j = sub.toJSON();
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth } }),
          });
          setPushEnabled(true);
        }
      }
    } catch { /* ignore */ }
    finally { setPushLoading(false); }
  }

  async function handleSavePrefs() {
    setPrefsSaving(true);
    await fetch("/api/push/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ morning_enabled: morningEnabled, morning_time: morningTime, evening_enabled: eveningEnabled, evening_time: eveningTime }),
    });
    setPrefsSaving(false);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  }

  async function handleApplyInvite() {
    if (!inviteInput.trim()) return;
    setInviteStatus("applying");
    setInviteMsg("");
    const res = await fetch("/api/special-invite/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteInput.trim() }),
    });
    const d = await res.json().catch(() => ({})) as { ok?: boolean; plan?: string; free_months?: number; error?: string };
    if (res.ok) {
      setInviteStatus("applied");
      const planName = d.plan === "premium" ? "永愛塾" : "AIパートナー";
      setInviteMsg(`${planName} ${d.free_months ?? ""}ヶ月分を適用しました。`);
      setInviteInput("");
      // student を再読み込み
      const settingsRes = await fetch("/api/settings");
      const settingsData = await settingsRes.json() as { student?: StudentData };
      if (settingsData.student) setStudent(settingsData.student);
    } else {
      setInviteStatus("invalid");
      setInviteMsg(d.error ?? "コードが無効です。");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={spinnerStyle} />
        </div>
      </AppLayout>
    );
  }

  const planLabel = student
    ? `${getPlanDisplayName(student.plan)}${student.plan !== "free" ? `・${student.billing_interval === "yearly" ? "年払い" : "月払い"}` : ""}`
    : "-";

  return (
    <AppLayout>
      <div style={pageStyle}>
        {upgraded && (
          <div style={bannerStyle}>
            プラン変更が反映されました
          </div>
        )}

        {/* ── 1. アカウント ── */}
        <Group label="アカウント">
          <Row label="メールアドレス" value={email || "-"} last />
        </Group>

        {/* ── 2. プランと支払い ── */}
        <Group label="プランと支払い">
          <Row label="現在のプラン" value={planLabel} />
          {student?.premium_until && student.plan !== "free" && (
            <Row label="有効期限" value={new Date(student.premium_until).toLocaleDateString("ja-JP")} />
          )}
          {student?.plan_source && (
            <Row label="取得方法" value={student.plan_source === "special_invite" ? "特別招待" : student.plan_source === "manual_grant" ? "無料付与" : "通常購入"} />
          )}
          <Row label="支払いサイクル" value={student?.plan !== "free" ? (student?.billing_interval === "yearly" ? "年払い" : "月払い") : "-"} last />
          <div style={{ padding: "12px 16px" }}>
            <button onClick={() => void handleManagePlan()} disabled={billingLoading} style={primaryBtnStyle(billingLoading)}>
              {billingLoading ? "処理中..." : student?.plan === "free" ? "プランをアップグレード" : student?.stripe_subscription_id ? "支払いを管理する" : "プランを変更する"}
            </button>
            {billingError && <p style={errorSmallStyle}>{billingError}</p>}
          </div>
        </Group>

        {/* ── 3. 学習設定 ── */}
        <Group label="学習設定">
          {/* プロフィール */}
          <FieldRow label="名前">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inlineInputStyle} placeholder="山田 太郎" />
          </FieldRow>
          <FieldRow label="学年">
            <select value={grade} onChange={(e) => setGrade(e.target.value)} style={inlineInputStyle}>
              {GRADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="志望校">
            <input value={targetUniv} onChange={(e) => setTargetUniv(e.target.value)} style={inlineInputStyle} placeholder="東京大学" />
          </FieldRow>
          <FieldRow label="受験日">
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={inlineInputStyle} />
          </FieldRow>
          {profileError && <p style={{ ...errorSmallStyle, padding: "0 16px 4px" }}>{profileError}</p>}
          <div style={{ padding: "10px 16px" }}>
            <button onClick={() => void handleSaveProfile()} disabled={profileSaving} style={primaryBtnStyle(profileSaving)}>
              {profileSaving ? "保存中..." : profileSaved ? "保存しました ✓" : "保存する"}
            </button>
          </div>

          <div style={divStyle} />

          {/* My先生 */}
          <div style={{ padding: "12px 16px 4px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8E8E93" }}>MY先生の口調</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {PERSONALITY_OPTIONS.map((opt) => (
                <button key={opt.key} onClick={() => { setPersonality(opt.key); void handleSavePersonality(); }} style={personalityBtnStyle(personality === opt.key)}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: personality === opt.key ? "#1D4ED8" : "#0F172A" }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: "#667085", marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
            {personalitySaving && <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>保存中...</p>}
          </div>

          <div style={divStyle} />

          {/* AI面談 */}
          <div style={{ padding: "12px 16px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#8E8E93" }}>本格AI面談</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#667085", lineHeight: 1.6 }}>
              志望校・苦手科目・勉強スタイルを整理して、あなた専用の学習ルートを作ります。
            </p>
            <button onClick={() => router.push("/onboarding")} style={outlineBtnStyle}>
              AI面談を始める
            </button>
          </div>
        </Group>

        {/* ── 4. 連携・コード入力 ── */}
        <Group label="連携・コード入力">
          {/* 招待コード入力 */}
          <div style={{ padding: "12px 16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8E8E93" }}>特別招待コード</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#667085" }}>
              塾や学校から受け取ったコードを入力すると、プランを無料で利用できます。
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={inviteInput}
                onChange={(e) => { setInviteInput(e.target.value.toUpperCase()); setInviteStatus("idle"); }}
                placeholder="例：INV-XXXXXX"
                style={{ ...inlineInputStyle, textAlign: "left", border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 12px", minHeight: 40, flex: 1 }}
              />
              <button onClick={() => void handleApplyInvite()} disabled={!inviteInput.trim() || inviteStatus === "applying" || inviteStatus === "applied"} style={{ ...copyBtnStyle, minWidth: 60 }}>
                {inviteStatus === "applying" ? "..." : "適用"}
              </button>
            </div>
            {inviteMsg && (
              <p style={{ ...errorSmallStyle, color: inviteStatus === "applied" ? "#059669" : "#DC2626", marginTop: 6 }}>
                {inviteMsg}
              </p>
            )}
          </div>

          <div style={divStyle} />

          {/* 通知 */}
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>プッシュ通知</div>
              <div style={{ fontSize: 12, color: "#667085", marginTop: 2 }}>{pushEnabled ? "有効" : "無効"}</div>
            </div>
            <button onClick={() => void handleTogglePush()} disabled={pushLoading} style={toggleTextBtnStyle(pushEnabled)}>
              {pushLoading ? "..." : pushEnabled ? "オフにする" : "許可する"}
            </button>
          </div>

          {pushEnabled && (
            <>
              <div style={divStyle} />
              <div style={{ padding: "12px 16px", display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>朝のリマインダー</div>
                    <input type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} disabled={!morningEnabled}
                      style={{ marginTop: 4, fontSize: 12, color: "#667085", border: "none", background: "transparent", opacity: morningEnabled ? 1 : 0.4, padding: 0 }} />
                  </div>
                  <ToggleSwitch checked={morningEnabled} onChange={setMorningEnabled} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>夜の振り返り</div>
                    <input type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} disabled={!eveningEnabled}
                      style={{ marginTop: 4, fontSize: 12, color: "#667085", border: "none", background: "transparent", opacity: eveningEnabled ? 1 : 0.4, padding: 0 }} />
                  </div>
                  <ToggleSwitch checked={eveningEnabled} onChange={setEveningEnabled} />
                </div>
              </div>
              <div style={{ padding: "0 16px 12px" }}>
                <button onClick={() => void handleSavePrefs()} disabled={prefsSaving} style={primaryBtnStyle(prefsSaving)}>
                  {prefsSaving ? "保存中..." : prefsSaved ? "保存しました ✓" : "通知設定を保存"}
                </button>
              </div>
            </>
          )}
        </Group>

        {/* ── 5. 招待・シェア ── */}
        {referralCode && (
          <Group label="招待・シェア">
            <div style={{ padding: "12px 16px" }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#0F172A", fontWeight: 700 }}>友達を招待する</p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#667085" }}>
                招待した友達が有料プランを購入すると、¥1,000分のAmazonギフト券をプレゼントします。
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={codeBoxStyle}>{referralCode}</div>
                <button onClick={async () => {
                  await navigator.clipboard.writeText(referralCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }} style={copyBtnStyle}>
                  {codeCopied ? "コピー済み" : "コピー"}
                </button>
              </div>
            </div>
          </Group>
        )}

        {/* ── 6. ログアウト ── */}
        <button onClick={() => void handleLogout()} style={logoutBtnStyle}>
          ログアウト
        </button>
      </div>
    </AppLayout>
  );
}

// ── サブコンポーネント ──────────────────────────────────────
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={groupStyle}>
      <p style={groupLabelStyle}>{label}</p>
      <div style={groupBodyStyle}>{children}</div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ ...rowStyle, borderBottom: last ? "none" : "1px solid #F1F5F9" }}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

function FieldRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div style={{ ...rowStyle, borderBottom: last ? "none" : "1px solid #F1F5F9" }}>
      <span style={rowLabelStyle}>{label}</span>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#3B52B4" : "#D0D5DD",
        border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 2, left: checked ? 22 : 2, width: 20, height: 20,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

// ── スタイル ──────────────────────────────────────────────
const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F2F2F7",
  padding: "16px 0 48px",
};

const bannerStyle: CSSProperties = {
  margin: "0 16px 16px",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#ECFDF3",
  border: "1px solid #A7F3D0",
  fontSize: 13,
  fontWeight: 700,
  color: "#065F46",
  textAlign: "center",
};

const spinnerStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "3px solid #D0D5DD",
  borderTopColor: "#3B52B4",
  animation: "spin 0.8s linear infinite",
};

const groupStyle: CSSProperties = {
  margin: "0 0 24px",
};

const groupLabelStyle: CSSProperties = {
  margin: "0 16px 6px",
  fontSize: 12,
  fontWeight: 700,
  color: "#8E8E93",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const groupBodyStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  margin: "0 16px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "13px 16px",
  gap: 12,
};

const rowLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#0F172A",
  flexShrink: 0,
};

const rowValueStyle: CSSProperties = {
  fontSize: 14,
  color: "#8E8E93",
  textAlign: "right",
  wordBreak: "break-all",
};

const inlineInputStyle: CSSProperties = {
  border: "none",
  outline: "none",
  fontSize: 14,
  color: "#0F172A",
  textAlign: "right",
  background: "transparent",
  width: "100%",
  maxWidth: 200,
};

const divStyle: CSSProperties = {
  height: 1,
  background: "#F1F5F9",
  margin: "0 16px",
};

const primaryBtnStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  padding: "13px",
  borderRadius: 12,
  border: "none",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #3655C6, #5C75DA)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  cursor: disabled ? "default" : "pointer",
});

const outlineBtnStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "1px solid #C7D7FE",
  background: "#EEF4FF",
  color: "#1D4ED8",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const toggleTextBtnStyle = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 20,
  border: "none",
  background: active ? "#FEE2E2" : "#EEF4FF",
  color: active ? "#DC2626" : "#3B52B4",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  flexShrink: 0,
});

const personalityBtnStyle = (selected: boolean): CSSProperties => ({
  padding: "10px 8px",
  borderRadius: 12,
  border: selected ? "2px solid #3B52B4" : "1px solid #E4E7EC",
  background: selected ? "#EEF4FF" : "#F8FAFC",
  cursor: "pointer",
  textAlign: "left",
});

const codeBoxStyle: CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  fontSize: 16,
  fontWeight: 900,
  color: "#065F46",
  letterSpacing: "0.1em",
  fontFamily: "monospace",
};

const copyBtnStyle: CSSProperties = {
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "#1E293B",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  flexShrink: 0,
};

const logoutBtnStyle: CSSProperties = {
  display: "block",
  width: "calc(100% - 32px)",
  margin: "0 16px",
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "#FFFFFF",
  color: "#DC2626",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const errorSmallStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "#DC2626",
  fontWeight: 600,
};
