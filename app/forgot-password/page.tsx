"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSent(true);
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={cardStyle}>
        <h1 style={headingStyle}>パスワードの再設定</h1>

        {sent ? (
          <div style={sentBoxStyle}>
            <p style={sentTitleStyle}>メールを送信しました</p>
            <p style={sentBodyStyle}>
              {email} 宛にパスワード再設定のリンクを送りました。
              メールを確認してリンクをクリックしてください。
            </p>
            <Link href="/login" style={backLinkStyle}>
              ログイン画面に戻る
            </Link>
          </div>
        ) : (
          <>
            <p style={subStyle}>
              登録したメールアドレスを入力してください。
              パスワード再設定のリンクを送ります。
            </p>

            <form onSubmit={handleSubmit} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>メールアドレス</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="you@example.com"
                  autoFocus
                />
              </label>

              {error && <p style={errorStyle}>{error}</p>}

              <button type="submit" disabled={loading} style={submitStyle(loading)}>
                {loading ? "送信中..." : "リンクを送る"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>

            <p style={switchStyle}>
              <Link href="/login" style={switchLinkStyle}>ログインに戻る</Link>
            </p>
          </>
        )}
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
  display: "grid",
  gap: 16,
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0F172A",
  textAlign: "center",
};

const subStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.7,
  textAlign: "center",
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

const errorStyle: CSSProperties = {
  margin: 0,
  color: "#DC2626",
  fontSize: 13,
  fontWeight: 700,
};

const sentBoxStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  textAlign: "center",
};

const sentTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#059669",
};

const sentBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.7,
};

const backLinkStyle: CSSProperties = {
  display: "inline-block",
  fontSize: 13,
  fontWeight: 700,
  color: "#3157B7",
  textDecoration: "underline",
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
