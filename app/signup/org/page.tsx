"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OrgSignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<"cram_school" | "school">("cram_school");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { name: adminName, role: "org_staff", org_name: orgName, org_type: orgType },
      },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await fetch("/api/user-role", { method: "POST" }).catch(() => null);
      router.push("/org");
      return;
    }

    setNotice("確認メールを送信しました。リンクから登録を完了すると、組織ダッシュボードへ進めます。");
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
          <Building2 size={22} color="#7C3AED" />
        </div>
        <h1 style={headingStyle}>塾・学校アカウントを作成</h1>
        <p style={subStyle}>
          複数の生徒を一覧で見たり、要注意生徒を把握したりするための管理画面入口です。
        </p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={sectionLabelStyle}>組織情報</div>

          <label style={fieldStyle}>
            <span style={labelStyle}>組織名</span>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              style={inputStyle}
              placeholder="永愛塾 町田校"
            />
          </label>

          <div style={fieldStyle}>
            <span style={labelStyle}>組織の種類</span>
            <div style={segmentStyle}>
              {(["cram_school", "school"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrgType(type)}
                  style={segmentButtonStyle(orgType === type)}
                >
                  {type === "cram_school" ? "塾・予備校" : "学校"}
                </button>
              ))}
            </div>
          </div>

          <div style={sectionLabelStyle}>管理者情報</div>

          <label style={fieldStyle}>
            <span style={labelStyle}>管理者名</span>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
              style={inputStyle}
              placeholder="山田 一郎"
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
              placeholder="admin@example.com"
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
              style={{ width: 16, height: 16, accentColor: "#7C3AED", flexShrink: 0 }}
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

          <button type="submit" disabled={loading} style={submitStyle(loading)}>
            {loading ? "作成中..." : "塾・学校として始める"}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div style={helperBoxStyle}>
          <div style={helperTitleStyle}>このあとできること</div>
          <div style={helperBodyStyle}>
            1. 生徒一覧の確認
            <br />
            2. 要注意生徒の把握
            <br />
            3. 各生徒の活動・成績・学習方針の確認
          </div>
        </div>

        <p style={switchStyle}>
          <Link href="/signup/student" style={switchLinkStyle}>生徒の方はこちら</Link>
          {" ・ "}
          <Link href="/signup/parent" style={switchLinkStyle}>保護者の方はこちら</Link>
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
  maxWidth: 460,
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
  background: "rgba(124,58,237,0.08)",
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

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  paddingTop: 4,
  borderTop: "1px solid #F1F5F9",
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

const segmentStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const segmentButtonStyle = (active: boolean): CSSProperties => ({
  minHeight: 42,
  borderRadius: 10,
  border: `1px solid ${active ? "#7C3AED" : "#E2E8F0"}`,
  background: active ? "rgba(124,58,237,0.08)" : "#FAFAFA",
  color: active ? "#7C3AED" : "#64748B",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});

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
  color: "#7C3AED",
  fontWeight: 700,
  textDecoration: "underline",
};

const submitStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  border: "none",
  background: disabled ? "#CBD5E1" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
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
