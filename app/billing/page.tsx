"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLAN_DEFINITIONS, type BillingInterval } from "@/lib/plans";

type Tier = "basic" | "premium";

const PLAN_COPY: Record<Tier, { title: string; description: string; features: string[] }> = {
  basic: {
    title: PLAN_DEFINITIONS.basic.name,
    description: "質問、記録、タイムライン、My先生で毎日の勉強を続けやすくするプランです。",
    features: [
      "問題質問は月30回まで",
      "学習記録とタイムライン",
      "My先生で日々の相談",
      "Todo・カレンダー・ホーム",
    ],
  },
  premium: {
    title: PLAN_DEFINITIONS.premium.name,
    description: "AIが学習ルートまで設計し、志望校に向けて勉強全体を導くプランです。",
    features: [
      "問題質問は無制限",
      "参考書ルートの設計",
      "優先順位と学習方針の提案",
      "模試や進捗からの再設計",
    ],
  },
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const nextPath = searchParams.get("next") || "/schedule";
  const fromOnboarding = searchParams.get("entry") === "onboarding";

  const priceLabel = useMemo(
    () => ({
      basic:
        interval === "monthly"
          ? `¥${PLAN_DEFINITIONS.basic.monthlyPrice.toLocaleString()} / 月`
          : `¥${PLAN_DEFINITIONS.basic.yearlyPrice.toLocaleString()} / 年`,
      premium:
        interval === "monthly"
          ? `¥${PLAN_DEFINITIONS.premium.monthlyPrice.toLocaleString()} / 月`
          : `¥${PLAN_DEFINITIONS.premium.yearlyPrice.toLocaleString()} / 年`,
    }),
    [interval]
  );

  async function handleCheckout(planKey: Tier) {
    setLoadingKey(planKey);
    setError("");

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey, interval }),
    });

    const data = await res.json().catch(() => ({}));
    if (data.url) {
      window.location.assign(data.url);
      return;
    }

    setLoadingKey(null);
    setError(data.message ?? data.error ?? "プランの準備に失敗しました。");
  }

  return (
    <div style={pageStyle}>
      <div style={wrapStyle} className="animate-up">
        <button onClick={() => router.back()} style={backButtonStyle}>
          戻る
        </button>

        <div style={{ marginBottom: 22 }}>
          <p style={eyebrowStyle}>Pricing</p>
          <h1 style={titleStyle}>{fromOnboarding ? "ルートを作成しました。次にプランを選びましょう" : "使い方に合わせてプランを選ぶ"}</h1>
          <p style={descStyle}>
            {fromOnboarding
              ? "AI面談の内容から学習ルートは作成済みです。ここで始め方を選んで、そのまま学習を進められます。"
              : "まずは AI伴走 から始めて、必要になったら 永愛塾 に広げる流れがおすすめです。"}
          </p>
        </div>

        <div style={switchWrapStyle}>
          <button type="button" onClick={() => setInterval("monthly")} style={interval === "monthly" ? activeSwitchStyle : switchStyle}>
            月払い
          </button>
          <button type="button" onClick={() => setInterval("yearly")} style={interval === "yearly" ? activeSwitchStyle : switchStyle}>
            年払い
          </button>
        </div>

        <div style={topActionRowStyle}>
          <Link href={nextPath} style={skipLinkStyle}>
            無料で続ける
          </Link>
        </div>

        <div style={gridStyle}>
          {(["basic", "premium"] as const).map((planKey) => (
            <section key={planKey} style={cardStyle(planKey === "premium")}>
              <div>
                <p style={planNameStyle(planKey === "premium")}>{PLAN_COPY[planKey].title}</p>
                <p style={priceStyle}>{priceLabel[planKey]}</p>
                <p style={cardDescStyle}>{PLAN_COPY[planKey].description}</p>
              </div>

              <ul style={featureListStyle}>
                {PLAN_COPY[planKey].features.map((feature) => (
                  <li key={feature} style={featureItemStyle}>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(planKey)}
                disabled={loadingKey != null}
                style={ctaStyle(planKey === "premium", loadingKey === planKey)}
              >
                {loadingKey === planKey ? "準備中..." : `${PLAN_COPY[planKey].title}を始める`}
              </button>
            </section>
          ))}
        </div>

        {interval === "yearly" ? <p style={footnoteStyle}>年払いは月払いよりお得です。Stripe の価格設定が入っている場合に利用できます。</p> : null}
        {error ? <p style={errorStyle}>{error}</p> : null}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(180deg, #F7F8FC 0%, #EFF3FA 100%)",
  padding: "32px 20px",
};

const wrapStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
};

const backButtonStyle: CSSProperties = {
  marginBottom: 18,
  background: "transparent",
  border: "none",
  color: "var(--text-muted)",
  fontSize: 14,
  cursor: "pointer",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#3B52B4",
};

const titleStyle: CSSProperties = {
  margin: "8px 0 10px",
  fontSize: "clamp(28px, 4vw, 40px)",
  lineHeight: 1.1,
  fontWeight: 800,
  color: "#111827",
};

const descStyle: CSSProperties = {
  margin: 0,
  maxWidth: 720,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#667085",
};

const switchWrapStyle: CSSProperties = {
  display: "inline-flex",
  padding: 4,
  borderRadius: 999,
  background: "#E9EEF9",
  gap: 6,
  marginTop: 20,
};

const switchStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "#475467",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const activeSwitchStyle: CSSProperties = {
  ...switchStyle,
  background: "#FFFFFF",
  color: "#233876",
  boxShadow: "0 4px 12px rgba(35, 56, 118, 0.08)",
};

const topActionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  margin: "18px 0 16px",
};

const skipLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(148,163,184,0.16)",
  fontSize: 13,
  fontWeight: 800,
  color: "#0F172A",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const cardStyle = (featured: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: 360,
  padding: 24,
  borderRadius: 24,
  background: featured ? "linear-gradient(180deg, #F8FBFF 0%, #EEF4FF 100%)" : "#FFFFFF",
  border: featured ? "1px solid #BFD0FF" : "1px solid #E4E7EC",
  boxShadow: featured ? "0 18px 40px rgba(59, 82, 180, 0.10)" : "0 10px 30px rgba(16, 24, 40, 0.06)",
});

const planNameStyle = (featured: boolean): CSSProperties => ({
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: featured ? "#2F4DB2" : "#344054",
});

const priceStyle: CSSProperties = {
  margin: "10px 0 10px",
  fontSize: 34,
  fontWeight: 800,
  color: "#101828",
};

const cardDescStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#667085",
};

const featureListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "20px 0",
  display: "grid",
  gap: 10,
};

const featureItemStyle: CSSProperties = {
  fontSize: 14,
  color: "#344054",
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.76)",
  border: "1px solid #E5E7EB",
};

const ctaStyle = (featured: boolean, loading: boolean): CSSProperties => ({
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: loading ? "#D0D5DD" : featured ? "linear-gradient(135deg, #3454C5, #5470D9)" : "#111827",
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 800,
  cursor: loading ? "not-allowed" : "pointer",
});

const footnoteStyle: CSSProperties = {
  margin: "16px 0 0",
  fontSize: 13,
  color: "#667085",
};

const errorStyle: CSSProperties = {
  marginTop: 14,
  color: "#B42318",
  fontSize: 14,
  fontWeight: 600,
};
