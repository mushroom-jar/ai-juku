import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowRight, BrainCircuit, CalendarCheck2, MessageSquareText, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRow?.role === "parent") redirect("/parent");
    if (roleRow?.role === "org_staff") redirect("/org");

    const { data: student } = await supabase
      .from("students")
      .select("onboarding_done, starter_questions_completed_at, ai_interview_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!student || !student.onboarding_done) redirect("/billing");
    if (!student.starter_questions_completed_at && !student.ai_interview_completed_at) redirect("/starter-questions");
    redirect("/schedule");
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoStyle}>
            <div style={logoBadgeStyle}>AI</div>
            <span style={logoTextStyle}>永愛塾</span>
          </Link>
          <div style={headerActionsStyle}>
            <Link href="/login?mode=signin" style={ghostButtonStyle}>ログイン</Link>
            <Link href="/signup/student" style={primaryButtonStyle}>無料で試す</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section style={heroStyle}>
          <div style={heroInnerStyle}>
            <div style={badgeStyle}>
              <span style={badgeDotStyle} />
              クレジットカード不要・今すぐ使える
            </div>
            <h1 style={heroTitleStyle}>
              今日やることが、<br />すぐわかる。
            </h1>
            <p style={heroBodyStyle}>
              永愛塾は、AIが毎日の自習をサポートする学習サービスです。<br />
              今日取り組む内容の整理・AI先生への質問・勉強記録がひとつにまとまります。
            </p>
            <div style={heroActionsStyle}>
              <Link href="/signup/student" style={primaryCtaStyle}>
                無料で試してみる <ArrowRight size={16} />
              </Link>
              <Link href="/login?mode=signin" style={secondaryCtaStyle}>ログイン</Link>
            </div>
            <p style={trialNoteStyle}>登録無料・プランは後から選べます</p>
          </div>
        </section>

        {/* Features */}
        <section style={featureSectionStyle}>
          <div style={sectionInnerStyle}>
            <h2 style={sectionTitleStyle}>使える機能</h2>
            <div style={featureGridStyle}>
              {[
                {
                  icon: <CalendarCheck2 size={22} color="#3157B7" />,
                  title: "今日のスケジュール",
                  body: "今日やるべきことをAIが整理。タスク・演習・予定が1画面で確認できます。",
                },
                {
                  icon: <MessageSquareText size={22} color="#3157B7" />,
                  title: "AI先生に質問・相談",
                  body: "わからない問題の質問から、勉強の悩みの相談まで。My先生がいつでも答えます。",
                },
                {
                  icon: <BrainCircuit size={22} color="#3157B7" />,
                  title: "AI面談で方針整理",
                  body: "初回に志望校や苦手を入力するだけで、AIが学習方針を提案します。",
                },
                {
                  icon: <TrendingUp size={22} color="#3157B7" />,
                  title: "学習記録・振り返り",
                  body: "演習の記録、勉強時間、ヒートマップで自分の進捗を可視化します。",
                },
              ].map((item) => (
                <div key={item.title} style={featureCardStyle}>
                  <div style={featureIconStyle}>{item.icon}</div>
                  <div style={featureTitleStyle}>{item.title}</div>
                  <div style={featureBodyTextStyle}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section style={howSectionStyle}>
          <div style={sectionInnerStyle}>
            <h2 style={sectionTitleStyle}>使い始め方</h2>
            <div style={stepsStyle}>
              {[
                { num: "1", title: "登録する（無料）", body: "メールアドレスだけで登録完了。クレジットカード不要です。" },
                { num: "2", title: "簡単な質問に答える", body: "学年・志望校・苦手科目の3問を選ぶだけでOKです。" },
                { num: "3", title: "すぐ使い始める", body: "今日のスケジュールとAI先生がすぐ使えます。" },
              ].map((step, i) => (
                <div key={step.num} style={stepItemStyle}>
                  <div style={stepNumStyle}>{step.num}</div>
                  {i < 2 && <div style={stepLineStyle} />}
                  <div style={stepContentStyle}>
                    <div style={stepTitleStyle}>{step.title}</div>
                    <div style={stepBodyStyle}>{step.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={ctaBlockStyle}>
              <Link href="/signup/student" style={primaryCtaStyle}>
                無料で試してみる <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section style={pricingSectionStyle}>
          <div style={sectionInnerStyle}>
            <h2 style={sectionTitleStyle}>プランと料金</h2>
            <p style={pricingLeadStyle}>まずは無料で使い始めて、必要になったらアップグレードできます。</p>
            <div style={pricingGridStyle}>
              <PricingCard
                title="無料プラン"
                price="¥0"
                note="ずっと無料"
                features={["今日のスケジュール", "AI先生（月10回まで）", "勉強記録"]}
              />
              <PricingCard
                title="AIパートナー"
                price="¥3,480"
                note="月額（税込）"
                features={["無料プランのすべて", "AI先生（月30回）", "My先生の個性設定", "振り返り・ヒートマップ"]}
              />
              <PricingCard
                title="AI塾"
                price="¥7,980"
                note="月額（税込）"
                features={["AIパートナーのすべて", "AI先生（無制限）", "参考書ルート設計", "AI面談で方針作成"]}
                highlight
              />
            </div>
          </div>
        </section>
      </main>

      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <span style={footerLogoStyle}>永愛塾</span>
          <div style={footerLinksStyle}>
            <Link href="/signup/parent" style={footerLinkStyle}>保護者の方へ</Link>
            <Link href="/signup/org" style={footerLinkStyle}>塾・学校の方へ</Link>
            <Link href="/login?mode=signin" style={footerLinkStyle}>ログイン</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  title, price, note, features, highlight,
}: {
  title: string; price: string; note: string; features: string[]; highlight?: boolean;
}) {
  return (
    <div style={{
      borderRadius: 20,
      padding: 24,
      background: highlight ? "#1E293B" : "#FFFFFF",
      border: highlight ? "none" : "1px solid #E2E8F0",
      display: "grid",
      gap: 10,
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: highlight ? "#93C5FD" : "#3157B7" }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.05em", color: highlight ? "#FFFFFF" : "#0F172A" }}>
        {price}
        <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? "rgba(255,255,255,0.6)" : "#64748B", marginLeft: 4 }}>{note}</span>
      </div>
      <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
        {features.map(f => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: highlight ? "rgba(255,255,255,0.8)" : "#475569" }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: highlight ? "#93C5FD" : "#3157B7", flexShrink: 0 }} />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#FFFFFF", color: "#0F172A" };

const headerStyle: CSSProperties = {
  position: "sticky", top: 0, zIndex: 40,
  background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)",
  borderBottom: "1px solid #EEF2F7",
};
const headerInnerStyle: CSSProperties = {
  maxWidth: 1120, margin: "0 auto", padding: "0 24px",
  minHeight: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
};
const logoStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" };
const logoBadgeStyle: CSSProperties = {
  width: 34, height: 34, borderRadius: 10, background: "#1E293B", color: "#FFFFFF",
  display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900,
};
const logoTextStyle: CSSProperties = { fontSize: 16, fontWeight: 900, letterSpacing: "-0.03em" };
const headerActionsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const ghostButtonStyle: CSSProperties = {
  minHeight: 38, padding: "0 16px", borderRadius: 999, border: "1px solid #D7E0EA",
  color: "#475569", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", textDecoration: "none",
};
const primaryButtonStyle: CSSProperties = {
  minHeight: 38, padding: "0 18px", borderRadius: 999, background: "#3157B7", color: "#FFFFFF",
  fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", textDecoration: "none",
};

const heroStyle: CSSProperties = { padding: "100px 24px 80px", borderBottom: "1px solid #EEF2F7" };
const heroInnerStyle: CSSProperties = { maxWidth: 760, margin: "0 auto", display: "grid", gap: 20 };
const badgeStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999,
  background: "#F0F7FF", border: "1px solid #C7DEFF", fontSize: 12, fontWeight: 700, color: "#3157B7",
};
const badgeDotStyle: CSSProperties = { width: 7, height: 7, borderRadius: 999, background: "#3157B7" };
const heroTitleStyle: CSSProperties = {
  margin: 0, fontSize: "clamp(44px, 7vw, 80px)", lineHeight: 1.05,
  letterSpacing: "-0.06em", fontWeight: 900,
};
const heroBodyStyle: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.9, color: "#475569" };
const heroActionsStyle: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" };
const primaryCtaStyle: CSSProperties = {
  minHeight: 52, padding: "0 24px", borderRadius: 999, background: "#3157B7", color: "#FFFFFF",
  fontSize: 15, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
};
const secondaryCtaStyle: CSSProperties = {
  minHeight: 52, padding: "0 20px", borderRadius: 999, border: "1px solid #D7E0EA",
  color: "#334155", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", textDecoration: "none",
};
const trialNoteStyle: CSSProperties = { margin: 0, fontSize: 12, color: "#94A3B8" };

const sectionInnerStyle: CSSProperties = { maxWidth: 1120, margin: "0 auto" };
const sectionTitleStyle: CSSProperties = {
  margin: "0 0 24px", fontSize: "clamp(24px, 3vw, 34px)",
  fontWeight: 900, letterSpacing: "-0.04em",
};

const featureSectionStyle: CSSProperties = { padding: "80px 24px" };
const featureGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16,
};
const featureCardStyle: CSSProperties = {
  borderRadius: 20, border: "1px solid #E2E8F0", background: "#F8FAFC", padding: 22, display: "grid", gap: 12,
};
const featureIconStyle: CSSProperties = {
  width: 44, height: 44, borderRadius: 14, background: "#EEF4FF",
  display: "grid", placeItems: "center",
};
const featureTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#0F172A" };
const featureBodyTextStyle: CSSProperties = { fontSize: 13, lineHeight: 1.75, color: "#475569" };

const howSectionStyle: CSSProperties = { padding: "0 24px 80px" };
const stepsStyle: CSSProperties = { display: "grid", gap: 0, maxWidth: 640 };
const stepItemStyle: CSSProperties = { display: "flex", gap: 16, alignItems: "flex-start", position: "relative" };
const stepNumStyle: CSSProperties = {
  width: 40, height: 40, borderRadius: 999, background: "#3157B7", color: "#FFFFFF",
  display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900, flexShrink: 0,
};
const stepLineStyle: CSSProperties = {
  position: "absolute", left: 19, top: 40, width: 2, height: 48, background: "#E2E8F0",
};
const stepContentStyle: CSSProperties = { paddingBottom: 48 };
const stepTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#0F172A", paddingTop: 8 };
const stepBodyStyle: CSSProperties = { marginTop: 4, fontSize: 13, lineHeight: 1.75, color: "#64748B" };
const ctaBlockStyle: CSSProperties = { marginTop: 8 };

const pricingSectionStyle: CSSProperties = { padding: "0 24px 80px", background: "#F8FAFC" };
const pricingLeadStyle: CSSProperties = { margin: "-16px 0 24px", fontSize: 14, color: "#64748B" };
const pricingGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16,
};

const footerStyle: CSSProperties = { borderTop: "1px solid #EEF2F7", padding: "24px" };
const footerInnerStyle: CSSProperties = {
  maxWidth: 1120, margin: "0 auto", display: "flex", justifyContent: "space-between",
  alignItems: "center", flexWrap: "wrap", gap: 12,
};
const footerLogoStyle: CSSProperties = { fontSize: 14, fontWeight: 900, color: "#94A3B8" };
const footerLinksStyle: CSSProperties = { display: "flex", gap: 20 };
const footerLinkStyle: CSSProperties = { fontSize: 13, color: "#94A3B8", textDecoration: "none" };
