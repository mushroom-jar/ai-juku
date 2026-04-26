"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSignup = mode === "signup";

  async function resolveNextPath(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "/login";

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRow?.role === "parent") return "/parent";
    if (roleRow?.role === "org_staff") return "/org";

    const { data: student } = await supabase
      .from("students")
      .select("id, onboarding_done, starter_questions_completed_at, ai_interview_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!student || !student.onboarding_done) return "/billing";
    if (!student.starter_questions_completed_at && !student.ai_interview_completed_at) return "/starter-questions";
    return "/schedule";
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    setError("");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleEmailAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isSignup && !agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setLoading("email");
    setError("");
    setNotice("");
    const supabase = createClient();

    if (isSignup) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { name },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(null);
        return;
      }

      if (data.session) {
        await fetch("/api/user-role", { method: "POST" }).catch(() => null);
        router.push("/billing");
        router.refresh();
        return;
      }

      setNotice("確認メールを送信しました。メール内のリンクから登録を完了してください。");
      setLoading(null);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(null);
      return;
    }

    const nextPath = await resolveNextPath(supabase);
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={cardStyle}>
        <h1 style={headingStyle}>{isSignup ? "アカウントを作成" : "ログイン"}</h1>

        <button onClick={() => void handleOAuth("google")} disabled={loading !== null} style={oauthButtonStyle}>
          <GoogleIcon />
          Google で{isSignup ? "始める" : "ログイン"}
        </button>

        <button onClick={() => void handleOAuth("apple")} disabled={loading !== null} style={{ ...oauthButtonStyle, marginTop: 8 }}>
          <AppleIcon />
          Apple で{isSignup ? "始める" : "ログイン"}
        </button>

        <div style={dividerStyle}>
          <div style={dividerLineStyle} />
          <span style={dividerTextStyle}>または</span>
          <div style={dividerLineStyle} />
        </div>

        <form onSubmit={handleEmailAuth} style={formStyle}>
          {isSignup && (
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
          )}

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
              style={inputStyle}
              placeholder="8文字以上"
              minLength={8}
            />
          </label>

          {isSignup && (
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#2563EB", flexShrink: 0 }}
              />
              <span style={checkboxLabelStyle}>
                <a href="/terms" style={checkboxLinkStyle} target="_blank">利用規約</a>
                {" と "}
                <a href="/privacy" style={checkboxLinkStyle} target="_blank">プライバシーポリシー</a>
                {" に同意します"}
              </span>
            </label>
          )}

          {error && <p style={errorStyle}>{error}</p>}
          {notice && <p style={noticeStyle}>{notice}</p>}

          <button type="submit" disabled={loading !== null} style={submitStyle}>
            {loading === "email" ? "送信中..." : isSignup ? "アカウントを作成" : "ログインする"}
            {loading !== "email" && <ArrowRight size={15} />}
          </button>
        </form>

        <p style={switchStyle}>
          {isSignup ? (
            <Link href="/login?mode=signin" style={switchLinkStyle}>ログイン画面へ戻る</Link>
          ) : (
            <>
              <Link href="/login?mode=signup" style={switchLinkStyle}>まだアカウントがない場合はこちら</Link>
              <span style={{ margin: "0 8px", color: "#CBD5E1" }}>·</span>
              <Link href="/forgot-password" style={switchLinkStyle}>パスワードを忘れた場合</Link>
            </>
          )}
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

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #E8E8E4",
  padding: "32px 28px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.05)",
};

const headingStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0F172A",
  margin: "0 0 24px",
  textAlign: "center",
};

const oauthButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  background: "#fff",
  fontSize: 14,
  fontWeight: 700,
  color: "#1E293B",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const dividerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "18px 0",
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
  outline: "none",
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

const checkboxLinkStyle: CSSProperties = {
  color: "#2563EB",
  fontWeight: 700,
  textDecoration: "underline",
};

const submitStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: "#2563EB",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 4,
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#DC2626",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6,
};

const switchStyle: CSSProperties = {
  margin: "20px 0 0",
  fontSize: 13,
  textAlign: "center",
};

const switchLinkStyle: CSSProperties = {
  color: "#64748B",
  fontWeight: 700,
  textDecoration: "underline",
};
