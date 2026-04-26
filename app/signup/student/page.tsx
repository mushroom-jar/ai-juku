"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" style={{ flexShrink: 0 }}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.8 0 249.9 0 128C0 57 18.4 0 59.5 0c46 0 135.7 108.1 135.7 189.8 0 70.9-45.4 157.9-95.5 225.4 0 0 56.6-8.8 100-8.8 90.5 0 186.3 45.4 240 113.6 0 0 57.8-75.5 135-75.5 56.5 0 122.8 29.4 155.5 83.5l2.4-1.1c-2.5-17.5-32.4-175.8-149.3-214.6z" fill="#000" />
    </svg>
  );
}

export default function StudentSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") ?? "";
  const inviteParam = searchParams.get("invite") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralInput, setReferralInput] = useState(refCode.toUpperCase());
  const [specialCode, setSpecialCode] = useState(inviteParam.toUpperCase());
  const [specialCodeStatus, setSpecialCodeStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [specialCodeInfo, setSpecialCodeInfo] = useState<{ plan: string; free_months: number } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState<"google" | "apple" | "email" | false>(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSpecialCodeBlur() {
    if (!specialCode.trim()) { setSpecialCodeStatus("idle"); setSpecialCodeInfo(null); return; }
    const res = await fetch("/api/special-invite/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: specialCode.trim() }),
    });
    const data = await res.json() as { valid: boolean; plan?: string; free_months?: number; error?: string };
    if (data.valid) {
      setSpecialCodeStatus("valid");
      setSpecialCodeInfo({ plan: data.plan!, free_months: data.free_months! });
    } else {
      setSpecialCodeStatus("invalid");
      setSpecialCodeInfo(null);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    setError("");
    const supabase = createClient();
    const inviteParam = specialCode.trim() ? `&invite=${encodeURIComponent(specialCode.trim())}` : "";
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?role=student${inviteParam}` },
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setLoading("email");
    setError("");
    setNotice("");

    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name,
          role: "student",
          referral_code: referralInput.trim() || undefined,
          special_invite_code: specialCode.trim() || undefined,
        },
      },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await fetch("/api/user-role", { method: "POST" }).catch(() => null);
      if (referralInput.trim()) {
        await fetch("/api/referral/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: referralInput.trim() }),
        }).catch(() => null);
      }
      // 特別招待コードがあれば適用して billing をスキップ
      if (specialCode.trim()) {
        const applyRes = await fetch("/api/special-invite/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: specialCode.trim() }),
        });
        if (applyRes.ok) {
          router.push("/starter-questions");
          return;
        }
      }
      router.push("/billing");
      return;
    }

    const noticeBase = "確認メールを送信しました。メールのリンクから登録を完了すると、";
    setNotice(specialCode.trim()
      ? `${noticeBase}招待プランが適用されてホームへ進めます。`
      : `${noticeBase}プラン選択へ進めます。`);
    setLoading(false);
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <GraduationCap size={22} color="#3157B7" />
        </div>
        <h1 style={headingStyle}>生徒アカウントを作成</h1>
        <p style={subStyle}>
          登録後にプランを選んで、すぐにホームで使い始められます。
        </p>

        <button onClick={() => void handleOAuth("google")} disabled={loading !== false} style={oauthBtnStyle(loading !== false)}>
          <GoogleIcon />
          Google で始める
        </button>
        <button onClick={() => void handleOAuth("apple")} disabled={loading !== false} style={{ ...oauthBtnStyle(loading !== false), marginTop: 8 }}>
          <AppleIcon />
          Apple で始める
        </button>

        <div style={dividerStyle}>
          <div style={dividerLineStyle} />
          <span style={dividerTextStyle}>またはメールアドレスで続ける</span>
          <div style={dividerLineStyle} />
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>表示名</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
              placeholder="山田 太郎"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
              placeholder="8文字以上"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>特別招待コード（任意）</span>
            <input
              value={specialCode}
              onChange={(e) => { setSpecialCode(e.target.value.toUpperCase()); setSpecialCodeStatus("idle"); setSpecialCodeInfo(null); }}
              onBlur={() => void handleSpecialCodeBlur()}
              style={{ ...inputStyle, borderColor: specialCodeStatus === "valid" ? "#059669" : specialCodeStatus === "invalid" ? "#DC2626" : "#E2E8F0" }}
              placeholder="例：INV-XXXXXX"
            />
            {specialCodeStatus === "valid" && specialCodeInfo && (
              <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
                有効：{specialCodeInfo.plan === "premium" ? "永愛塾" : "AIパートナー"} {specialCodeInfo.free_months}ヶ月無料
              </span>
            )}
            {specialCodeStatus === "invalid" && (
              <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>このコードは無効または使用済みです</span>
            )}
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>紹介コード（任意）</span>
            <input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder="例：ABCD-1234"
            />
          </label>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#3157B7", flexShrink: 0 }}
            />
            <span style={checkboxLabelStyle}>
              <a href="/terms" style={linkStyle} target="_blank">利用規約</a>
              {" と "}
              <a href="/privacy" style={linkStyle} target="_blank">プライバシーポリシー</a>
              {" に同意します"}
            </span>
          </label>

          {error && <p style={errorStyle}>{error}</p>}
          {notice && <p style={noticeStyle}>{notice}</p>}

          <button type="submit" disabled={loading !== false} style={submitStyle(loading !== false)}>
            {loading === "email" ? "作成中..." : "生徒として始める"}
            {loading !== "email" && <ArrowRight size={15} />}
          </button>
        </form>

        <div style={helperBoxStyle}>
          <div style={helperTitleStyle}>このあと進む流れ</div>
          {specialCodeStatus === "valid" ? (
            <div style={{ ...helperBodyStyle, color: "#059669" }}>
              1. アカウント登録
              <br />
              2. 招待コードでプランを無料適用
              <br />
              3. 3問だけ答えてホームへ
            </div>
          ) : (
            <div style={helperBodyStyle}>
              1. アカウント登録
              <br />
              2. プランを選ぶ（1週間無料から）
              <br />
              3. 3問だけ答えてホームへ
            </div>
          )}
        </div>

        <p style={switchStyle}>
          <Link href="/signup/parent" style={switchLinkStyle}>保護者の方はこちら</Link>
          {" ・ "}
          <Link href="/signup/org" style={switchLinkStyle}>塾・学校の方はこちら</Link>
          {" ・ "}
          <Link href="/login" style={switchLinkStyle}>ログインへ戻る</Link>
        </p>
      </div>
    </div>
  );
}

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
  marginBottom: 28,
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

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #E8E8E4",
  padding: "28px 28px 24px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.05)",
  display: "grid",
  gap: 16,
};

const iconWrapStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "rgba(49,87,183,0.08)",
  display: "grid",
  placeItems: "center",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
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

const formStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const inputStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  background: "#FAFAFA",
  padding: "0 14px",
  fontSize: 14,
  color: "#0F172A",
  width: "100%",
  boxSizing: "border-box",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  cursor: "pointer",
};

const checkboxLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.6,
};

const linkStyle: CSSProperties = {
  color: "#3157B7",
  fontWeight: 700,
  textDecoration: "underline",
};

const oauthBtnStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  background: disabled ? "#F8FAFC" : "#fff",
  fontSize: 14,
  fontWeight: 700,
  color: "#1E293B",
  cursor: disabled ? "default" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
});

const dividerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "4px 0",
};

const dividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: "#F1F5F9",
};

const dividerTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#CBD5E1",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const submitStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #3157B7, #5E78DA)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: disabled ? "default" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
});

const helperBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: 16,
  display: "grid",
  gap: 8,
};

const helperTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0F172A",
};

const helperBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.8,
  color: "#475569",
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#DC2626",
  fontSize: 13,
  fontWeight: 700,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
};

const switchStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  textAlign: "center",
  lineHeight: 1.8,
};

const switchLinkStyle: CSSProperties = {
  color: "#64748B",
  fontWeight: 700,
  textDecoration: "underline",
};
