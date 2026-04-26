"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { PLAN_DEFINITIONS, LUMP_SUM_OPTIONS, getLumpSumAmount, type LumpSumMonths } from "@/lib/plans";

type StudentInfo = {
  name: string;
  grade: number;
  targetUniv: string | null;
  currentPlan: string;
};

type PlanKey = "basic" | "premium";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  basic: ["AI質問 月30回まで", "学習記録・タイムライン", "My先生で日々の相談", "親・塾との連携"],
  premium: ["AI質問 無制限", "参考書ルートの自動設計", "AI学習戦略レポート", "親・塾との連携", "模試分析"],
};

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [planKey, setPlanKey] = useState<PlanKey>("premium");
  const [months, setMonths] = useState<LumpSumMonths>(1);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/pay/${token}`);
      if (!res.ok) { setNotFound(true); return; }
      setStudent(await res.json() as StudentInfo);
    })();
  }, [token]);

  async function handleCheckout() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/pay/${token}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey, months, referralCode: referralCode.trim() || undefined }),
    });
    const json = await res.json() as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setError(json.error ?? "エラーが発生しました");
      setLoading(false);
      return;
    }
    window.location.href = json.url;
  }

  if (isSuccess) {
    return (
      <div style={pageStyle}>
        <div style={successCardStyle}>
          <CheckCircle2 size={48} color="#059669" />
          <h1 style={{ ...headingStyle, marginTop: 16 }}>お支払いが完了しました</h1>
          <p style={subStyle}>{student?.name ?? ""}さんのプランが有効になりました。</p>
          <Link href="/" style={backLinkStyle}>トップへ戻る</Link>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: "center", color: "#64748B", fontSize: 14 }}>
            このリンクは無効か期限切れです。
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={pageStyle}>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={spinnerStyle} />
        </div>
      </div>
    );
  }

  const amount = months === 1
    ? PLAN_DEFINITIONS[planKey].monthlyPrice
    : getLumpSumAmount(planKey, months);
  const option = LUMP_SUM_OPTIONS.find((o) => o.months === months)!;
  const isSubscription = months === 1;

  return (
    <div style={pageStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ロゴ */}
      <div style={logoRowStyle}>
        <div style={logoBadgeStyle}>AI</div>
        <span style={logoTextStyle}>永愛塾</span>
      </div>

      {/* 生徒情報 */}
      <div style={studentBannerStyle}>
        <div style={avatarStyle}>{student.name.charAt(0)}</div>
        <div>
          <p style={studentNameStyle}>{student.name}さんへのプランを選択</p>
          <p style={studentMetaStyle}>
            高{student.grade}
            {student.targetUniv ? `・${student.targetUniv}` : ""}
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        {/* プラン選択 */}
        <div>
          <p style={sectionLabelStyle}>プランを選ぶ</p>
          <div style={planGridStyle}>
            {(["basic", "premium"] as PlanKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setPlanKey(key)}
                style={planBtnStyle(planKey === key)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: planKey === key ? "#7C3AED" : "#0F172A" }}>
                    {PLAN_DEFINITIONS[key].name}
                  </span>
                  {key === "premium" && (
                    <span style={recommendBadgeStyle}>おすすめ</span>
                  )}
                </div>
                <ul style={featureListStyle}>
                  {PLAN_FEATURES[key].map((f) => (
                    <li key={f} style={featureItemStyle}>
                      <CheckCircle2 size={12} color="#7C3AED" style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>

        {/* 期間選択 */}
        <div>
          <p style={sectionLabelStyle}>支払い期間</p>
          <div style={monthGridStyle}>
            {LUMP_SUM_OPTIONS.map((opt) => (
              <button
                key={opt.months}
                onClick={() => setMonths(opt.months as LumpSumMonths)}
                style={monthBtnStyle(months === opt.months)}
              >
                <span style={{ fontWeight: 900, fontSize: 14 }}>{opt.label}</span>
                {opt.discountPct > 0 && (
                  <span style={discountBadgeStyle}>{opt.discountPct}%OFF</span>
                )}
                {opt.months === 1 && (
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>毎月自動更新</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 招待コード */}
        <div>
          <label style={sectionLabelStyle}>招待コード（任意）</label>
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="例：TANAKA-X7K2"
            style={codeInputStyle}
          />
        </div>

        {/* 金額表示 */}
        <div style={priceSummaryStyle}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={priceStyle}>¥{amount.toLocaleString()}</span>
            <span style={priceSuffixStyle}>
              {isSubscription ? "/ 月（自動更新）" : `（${months}ヶ月分・一括）`}
            </span>
          </div>
          {!isSubscription && option.discountPct > 0 && (
            <p style={discountNoteStyle}>
              月額換算 ¥{Math.floor(amount / months).toLocaleString()} / 月（{option.discountPct}%お得）
            </p>
          )}
          {isSubscription && (
            <p style={discountNoteStyle}>初回7日間無料トライアル付き</p>
          )}
          {months === 12 && (
            <p style={discountNoteStyle}>
              <Sparkles size={12} style={{ display: "inline", marginRight: 3 }} />
              年払いで最大17%お得
            </p>
          )}
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <button onClick={handleCheckout} disabled={loading} style={checkoutBtnStyle}>
          {loading ? "処理中..." : "カードで支払う"}
          {!loading && <ChevronRight size={16} />}
        </button>

        <p style={noteStyle}>
          Stripe の安全な決済ページへ移動します。カード情報はこのサービスには送信されません。
        </p>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#F7F7F5",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "32px 16px 80px",
};

const logoRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, marginBottom: 24,
};
const logoBadgeStyle: CSSProperties = {
  width: 32, height: 32, borderRadius: 9, background: "#1E293B",
  color: "#fff", fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center",
};
const logoTextStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#1E293B" };

const studentBannerStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  background: "#1E293B", borderRadius: 16, padding: "16px 20px",
  width: "100%", maxWidth: 480, marginBottom: 16, boxSizing: "border-box",
};
const avatarStyle: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, background: "#7C3AED",
  color: "#fff", fontSize: 16, fontWeight: 900, display: "grid", placeItems: "center", flexShrink: 0,
};
const studentNameStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900, color: "#fff" };
const studentMetaStyle: CSSProperties = { margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 };

const cardStyle: CSSProperties = {
  width: "100%", maxWidth: 480, background: "#fff", borderRadius: 20,
  border: "1px solid #E8E8E4", padding: "24px 20px", display: "grid", gap: 20,
  boxSizing: "border-box",
};

const headingStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 900, color: "#0F172A", textAlign: "center" };
const subStyle: CSSProperties = { margin: "8px 0 0", fontSize: 14, color: "#64748B", textAlign: "center" };

const successCardStyle: CSSProperties = {
  ...cardStyle, maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px",
};
const backLinkStyle: CSSProperties = {
  marginTop: 20, fontSize: 14, fontWeight: 700, color: "#7C3AED", textDecoration: "none",
};

const sectionLabelStyle: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 800, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
};

const planGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const planBtnStyle = (active: boolean): CSSProperties => ({
  padding: "14px 12px", borderRadius: 14, textAlign: "left", cursor: "pointer",
  border: active ? "2px solid #7C3AED" : "1px solid #E2E8F0",
  background: active ? "#F5F3FF" : "#FAFAFA",
  display: "grid", gap: 10,
});
const recommendBadgeStyle: CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#7C3AED", background: "#EDE9FE",
  padding: "2px 7px", borderRadius: 999,
};
const featureListStyle: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 5 };
const featureItemStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11, color: "#475569", lineHeight: 1.5,
};

const monthGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 };
const monthBtnStyle = (active: boolean): CSSProperties => ({
  padding: "12px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer",
  border: active ? "2px solid #7C3AED" : "1px solid #E2E8F0",
  background: active ? "#F5F3FF" : "#FAFAFA",
  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
});
const discountBadgeStyle: CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#059669", background: "#DCFCE7",
  padding: "2px 6px", borderRadius: 999,
};

const codeInputStyle: CSSProperties = {
  width: "100%", minHeight: 44, borderRadius: 10, border: "1px solid #E2E8F0",
  padding: "0 14px", fontSize: 14, color: "#0F172A", background: "#FAFAFA",
  boxSizing: "border-box", letterSpacing: "0.05em",
};

const priceSummaryStyle: CSSProperties = {
  background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", display: "grid", gap: 4,
};
const priceStyle: CSSProperties = { fontSize: 28, fontWeight: 900, color: "#0F172A" };
const priceSuffixStyle: CSSProperties = { fontSize: 13, color: "#64748B" };
const discountNoteStyle: CSSProperties = { margin: 0, fontSize: 12, color: "#059669", fontWeight: 700 };

const checkoutBtnStyle: CSSProperties = {
  width: "100%", minHeight: 52, borderRadius: 999, border: "none",
  background: "#7C3AED", color: "#fff", fontSize: 15, fontWeight: 900,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};

const errorStyle: CSSProperties = { margin: 0, color: "#DC2626", fontSize: 13, fontWeight: 700 };

const noteStyle: CSSProperties = {
  margin: 0, fontSize: 11, color: "#94A3B8", textAlign: "center", lineHeight: 1.7,
};

const spinnerStyle: CSSProperties = {
  width: 32, height: 32, border: "3px solid #E2E8F0",
  borderTop: "3px solid #7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
