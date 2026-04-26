"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ParentSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(null);

  async function handleAppleSignup() {
    setLoading("apple");
    setError("");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=parent` },
    });
  }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleGoogleSignup() {
    setLoading("google");
    setError("");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=parent`,
      },
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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name,
          role: "parent",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(null);
      return;
    }

    if (data.session) {
      await fetch("/api/user-role", { method: "POST" }).catch(() => null);
      router.push("/parent");
      return;
    }

    setNotice("確認メールを送信しました。メール内のリンクから登録を完了してください。");
    setLoading(null);
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <Users size={22} color="#059669" />
        </div>
        <h1 style={headingStyle}>保護者アカウントを作成</h1>
        <p style={subStyle}>
          お子さまの学習状況や今週の積み上がりを確認できる、保護者向けの入口です。
        </p>

        <div style={featureListStyle}>
          {[
            "今週・今月の勉強時間を確認",
            "AIが考えた学習方針を把握",
            "親メモで希望や方針を残せる",
          ].map((feature) => (
            <div key={feature} style={featureItemStyle}>
              <div style={featureDotStyle} />
              <span style={featureTextStyle}>{feature}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading !== null}
          style={googleButtonStyle(loading !== null)}
        >
          <GoogleIcon />
          Google で保護者登録
        </button>

        <button
          onClick={() => void handleAppleSignup()}
          disabled={loading !== null}
          style={{ ...googleButtonStyle(loading !== null), marginTop: 8 }}
        >
          <AppleIcon />
          Apple で保護者登録
        </button>

        <div style={dividerStyle}>
          <div style={dividerLineStyle} />
          <span style={dividerTextStyle}>またはメールで登録</span>
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
              placeholder="山田 花子"
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
              placeholder="parent@example.com"
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

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={checkboxStyle}
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

          <button type="submit" disabled={loading !== null} style={submitStyle(loading !== null)}>
            {loading === "email" ? "作成中..." : loading === "google" || loading === "apple" ? "リダイレクト中..." : "メールで保護者登録"}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <p style={termsNoteStyle}>
          Googleで登録する場合も
          <a href="/terms" style={linkStyle} target="_blank">利用規約</a>
          {" と "}
          <a href="/privacy" style={linkStyle} target="_blank">プライバシーポリシー</a>
          に同意したものとみなします。
        </p>

        <p style={switchStyle}>
          <Link href="/signup/student" style={switchLinkStyle}>生徒として始める</Link>
          {" ・ "}
          <Link href="/signup/org" style={switchLinkStyle}>塾・学校として始める</Link>
          {" ・ "}
          <Link href="/login" style={switchLinkStyle}>ログイン</Link>
        </p>
      </div>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 814 1000" style={{ flexShrink: 0 }}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.8 0 249.9 0 128C0 57 18.4 0 59.5 0c46 0 135.7 108.1 135.7 189.8 0 70.9-45.4 157.9-95.5 225.4 0 0 56.6-8.8 100-8.8 90.5 0 186.3 45.4 240 113.6 0 0 57.8-75.5 135-75.5 56.5 0 122.8 29.4 155.5 83.5l2.4-1.1c-2.5-17.5-32.4-175.8-149.3-214.6z" fill="#000" />
    </svg>
  );
}

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
  background: "rgba(5,150,105,0.08)",
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
  lineHeight: 1.6,
};

const featureListStyle: CSSProperties = {
  background: "#F0FDF4",
  borderRadius: 12,
  padding: "12px 14px",
  display: "grid",
  gap: 8,
};

const featureItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const featureDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: "#059669",
  flexShrink: 0,
};

const featureTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#475569",
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

const checkboxStyle: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: "#059669",
  flexShrink: 0,
};

const checkboxLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.6,
};

const linkStyle: CSSProperties = {
  color: "#059669",
  fontWeight: 700,
  textDecoration: "underline",
};

const googleButtonStyle = (disabled: boolean): CSSProperties => ({
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
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #059669, #10B981)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: disabled ? "default" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
});

const termsNoteStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#94A3B8",
  lineHeight: 1.6,
  textAlign: "center",
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
};

const switchLinkStyle: CSSProperties = {
  color: "#64748B",
  fontWeight: 700,
  textDecoration: "underline",
};
