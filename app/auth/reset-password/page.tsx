"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase はメールリンクから来たとき URL フラグメントにトークンを入れる
  // onAuthStateChange で SIGNED_IN / PASSWORD_RECOVERY を検知して有効化
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });
    // すでにセッションがある場合も対応
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/schedule"), 2500);
  }

  if (!sessionReady) {
    return (
      <div style={pageStyle}>
        <div style={spinnerWrapStyle}>
          <div style={spinnerStyle} />
          <p style={{ marginTop: 14, fontSize: 13, color: "#94A3B8" }}>確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Link href="/" style={logoStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </Link>

      <div style={cardStyle}>
        <h1 style={headingStyle}>新しいパスワードを設定</h1>

        {done ? (
          <div style={doneBoxStyle}>
            <p style={doneTitleStyle}>パスワードを変更しました</p>
            <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
              ホームへ移動します...
            </p>
          </div>
        ) : (
          <>
            <p style={subStyle}>8文字以上のパスワードを入力してください。</p>

            <form onSubmit={handleSubmit} style={formStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>新しいパスワード</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                  placeholder="8文字以上"
                  autoFocus
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>パスワードの確認</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="もう一度入力"
                />
              </label>

              {error && <p style={errorStyle}>{error}</p>}

              <button type="submit" disabled={loading} style={submitStyle(loading)}>
                {loading ? "更新中..." : "パスワードを変更する"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>
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

const spinnerWrapStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "3px solid #E2E8F0",
  borderTopColor: "#3157B7",
  animation: "spin 0.8s linear infinite",
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

const doneBoxStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  textAlign: "center",
};

const doneTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#059669",
};
