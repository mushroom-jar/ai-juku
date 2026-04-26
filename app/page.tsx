import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarCheck2,
  GraduationCap,
  HeartHandshake,
  MessageSquareText,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoStyle}>
            <div style={logoBadgeStyle}>AI</div>
            <span style={logoTextStyle}>永愛塾</span>
          </Link>
          <div style={headerActionsStyle}>
            <Link href="/login?mode=signin" style={ghostButtonStyle}>
              ログイン
            </Link>
            <Link href="/signup/student" style={primaryButtonStyle}>
              生徒として始める
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={heroStyle}>
          <div style={heroInnerStyle}>
            <p style={eyebrowStyle}>AIが毎日の自習をサポートする学習塾</p>
            <h1 style={heroTitleStyle}>
              毎日の自習が続く。
              <br />
              保護者も、塾も、同じ画面で見守れる。
            </h1>
            <p style={heroBodyStyle}>
              永愛塾は、生徒の記録・相談・質問・学習方針をひとつにまとめた学習基盤です。
              生徒は今日やることがすぐ分かり、保護者は学習状況を確認でき、塾や学校は複数生徒を俯瞰できます。
            </p>
            <div style={heroActionsStyle}>
              <Link href="/signup/student" style={primaryCtaStyle}>
                生徒として始める <ArrowRight size={16} />
              </Link>
              <Link href="/signup/parent" style={secondaryCtaStyle}>
                保護者として始める
              </Link>
              <Link href="/signup/org" style={secondaryCtaStyle}>
                塾・学校として始める
              </Link>
            </div>
            <div style={proofRowStyle}>
              {[
                { icon: <BrainCircuit size={18} />, label: "AI面談で初回方針を整理" },
                { icon: <CalendarCheck2 size={18} />, label: "予定と勉強時間を一緒に管理" },
                { icon: <MessageSquareText size={18} />, label: "My先生に質問と相談ができる" },
                { icon: <ShieldCheck size={18} />, label: "保護者・塾向けの見守り導線" },
              ].map((item) => (
                <div key={item.label} style={proofPillStyle}>
                  <div style={proofIconStyle}>{item.icon}</div>
                  <span style={proofLabelStyle}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={roleSectionStyle}>
          <div style={sectionInnerStyle}>
            <p style={sectionEyebrowStyle}>Choose your start</p>
            <h2 style={sectionTitleStyle}>だれとして使い始めるかを最初に選べます</h2>
            <div style={roleGridStyle}>
              <RoleCard
                href="/signup/student"
                icon={<GraduationCap size={22} color="#3157B7" />}
                title="生徒として始める"
                subtitle="毎日の自習を進めたい人向け"
                bullets={[
                  "AI面談から始めて、今日やることを整理",
                  "演習記録・質問・復習・タイムラインをまとめて使える",
                  "1週間無料体験でAIパートナーを始められる",
                ]}
                accent="#3157B7"
              />
              <RoleCard
                href="/signup/parent"
                icon={<HeartHandshake size={22} color="#C26B2E" />}
                title="保護者として始める"
                subtitle="子どもの学習状況を見たい人向け"
                bullets={[
                  "今週の勉強時間、成績推移、最近の活動をまとめて確認",
                  "AIが考える学習方針と注意点を見られる",
                  "子どもを見守りながら、優先科目や希望勉強時間を残せる",
                ]}
                accent="#C26B2E"
              />
              <RoleCard
                href="/signup/org"
                icon={<Building2 size={22} color="#7C3AED" />}
                title="塾・学校として始める"
                subtitle="複数生徒をまとめて見たい方向け"
                bullets={[
                  "生徒一覧、要注意生徒、学習時間の偏りを俯瞰できる",
                  "各生徒の学習方針・成績・最近の活動まで追える",
                  "まずは最小構成の管理ダッシュボードから始められる",
                ]}
                accent="#7C3AED"
              />
            </div>
          </div>
        </section>

        <section style={featureSectionStyle}>
          <div style={sectionInnerStyle}>
            <p style={sectionEyebrowStyle}>Why Eiai</p>
            <h2 style={sectionTitleStyle}>記録アプリで終わらないのが永愛塾です</h2>
            <div style={featureGridStyle}>
              {[
                {
                  icon: <BookOpen size={20} />,
                  title: "記録が続きやすい",
                  body: "演習記録、自由記録、勉強時間の保存まで同じ場所で進められるので、あとから見返しても何をしたかが分かります。",
                },
                {
                  icon: <Users size={20} />,
                  title: "見守る側にも価値がある",
                  body: "保護者は学習状況と方針を確認でき、塾や学校は複数生徒を並べて見ることができます。",
                },
                {
                  icon: <Route size={20} />,
                  title: "AIが方針を整理する",
                  body: "初回面談や日々の記録をもとに、AIが今の状態を要約し、次に何を優先するかを見える化します。",
                },
                {
                  icon: <MessageSquareText size={20} />,
                  title: "相談と質問が一体",
                  body: "My先生の中で相談も質問もできるので、分からないところで止まらず、そのまま次の学習へ進めます。",
                },
              ].map((item) => (
                <div key={item.title} style={featureCardStyle}>
                  <div style={featureIconWrapStyle}>{item.icon}</div>
                  <div style={featureTitleStyle}>{item.title}</div>
                  <div style={featureBodyTextStyle}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={pricingSectionStyle}>
          <div style={sectionInnerStyle}>
            <p style={sectionEyebrowStyle}>Pricing idea</p>
            <h2 style={sectionTitleStyle}>いまの料金と機能は、この形が一番きれいです</h2>
            <p style={pricingLeadStyle}>
              生徒向けは「AIパートナー」を入口にして、必要になった時に「AI塾」へ進む形が自然です。
              保護者向けと塾向けは、学習管理ダッシュボードを軸に別商品として育てるのが良さそうです。
            </p>
            <div style={pricingGridStyle}>
              <PricingCard
                title="AIパートナー"
                price="月額 3,480円"
                note="1週間無料体験から始める入口"
                features={[
                  "ホーム、演習記録、カレンダー、振り返り",
                  "My先生で相談・質問ができる",
                  "質問回数は上限ありで十分使える設計",
                  "まず自習を続けるためのプラン",
                ]}
              />
              <PricingCard
                title="AI塾"
                price="月額 7,980円"
                note="AIパートナー利用中に体験導線を出す上位プラン"
                features={[
                  "AIパートナーの機能をすべて含む",
                  "学習方針、優先科目、最初の一週間の提案を強化",
                  "質問回数は実質無制限で使える想定",
                  "何を勉強すべきかまで一緒に考えるプラン",
                ]}
                highlight
              />
            </div>
            <div style={futureBoxStyle}>
              <div style={futureBoxTitleStyle}>今後の販売整理</div>
              <div style={futureBoxBodyStyle}>
                1. 生徒向けは AIパートナー を主導線にする
                <br />
                2. 保護者向けは「子どもの状況が見えるダッシュボード」を価値にする
                <br />
                3. 塾・学校向けは「複数生徒を管理できる画面」を別商品として育てる
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function RoleCard({
  href,
  icon,
  title,
  subtitle,
  bullets,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
}) {
  return (
    <div style={roleCardStyle}>
      <div style={{ ...roleIconStyle, background: `${accent}14` }}>{icon}</div>
      <div style={roleTitleStyle}>{title}</div>
      <div style={roleSubtitleStyle}>{subtitle}</div>
      <div style={roleBulletListStyle}>
        {bullets.map((bullet) => (
          <div key={bullet} style={roleBulletStyle}>
            <div style={{ ...roleBulletDotStyle, background: accent }} />
            <span>{bullet}</span>
          </div>
        ))}
      </div>
      <Link href={href} style={{ ...roleLinkStyle, background: accent }}>
        この入口から始める <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function PricingCard({
  title,
  price,
  note,
  features,
  highlight,
}: {
  title: string;
  price: string;
  note: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...pricingCardStyle,
        background: highlight ? "#1E293B" : "#FFFFFF",
        border: highlight ? "1px solid #1E293B" : "1px solid #E2E8F0",
      }}
    >
      <div style={{ ...pricingTitleStyle, color: highlight ? "#FFFFFF" : "#0F172A" }}>{title}</div>
      <div style={{ ...pricingPriceStyle, color: highlight ? "#FFFFFF" : "#0F172A" }}>{price}</div>
      <div style={{ ...pricingNoteStyle, color: highlight ? "rgba(255,255,255,0.72)" : "#64748B" }}>{note}</div>
      <div style={pricingFeatureListStyle}>
        {features.map((feature) => (
          <div key={feature} style={pricingFeatureItemStyle}>
            <div style={{ ...pricingFeatureDotStyle, background: highlight ? "#93C5FD" : "#3157B7" }} />
            <span style={{ color: highlight ? "rgba(255,255,255,0.86)" : "#475569" }}>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#FFFFFF",
  color: "#0F172A",
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 40,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid #EEF2F7",
};

const headerInnerStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 24px",
  minHeight: 68,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const logoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "inherit",
  textDecoration: "none",
};

const logoBadgeStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  background: "#1E293B",
  color: "#FFFFFF",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 900,
};

const logoTextStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const ghostButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid #D7E0EA",
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 18px",
  borderRadius: 999,
  background: "#3157B7",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const heroStyle: CSSProperties = {
  padding: "96px 24px 64px",
  borderBottom: "1px solid #EEF2F7",
};

const heroInnerStyle: CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#64748B",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(40px, 6vw, 72px)",
  lineHeight: 1.05,
  letterSpacing: "-0.06em",
  fontWeight: 900,
};

const heroBodyStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 17,
  lineHeight: 1.85,
  color: "#475569",
};

const heroActionsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryCtaStyle: CSSProperties = {
  minHeight: 52,
  padding: "0 22px",
  borderRadius: 999,
  background: "#3157B7",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
};

const secondaryCtaStyle: CSSProperties = {
  minHeight: 52,
  padding: "0 20px",
  borderRadius: 999,
  border: "1px solid #D7E0EA",
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const proofRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
};

const proofPillStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: "10px 14px",
};

const proofIconStyle: CSSProperties = {
  color: "#3157B7",
  display: "grid",
  placeItems: "center",
};

const proofLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#1E293B",
};

const roleSectionStyle: CSSProperties = {
  padding: "72px 24px",
};

const featureSectionStyle: CSSProperties = {
  padding: "32px 24px 72px",
};

const pricingSectionStyle: CSSProperties = {
  padding: "0 24px 84px",
};

const sectionInnerStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
};

const sectionEyebrowStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94A3B8",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(28px, 3.6vw, 40px)",
  lineHeight: 1.18,
  letterSpacing: "-0.04em",
  fontWeight: 900,
};

const roleGridStyle: CSSProperties = {
  marginTop: 26,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

const roleCardStyle: CSSProperties = {
  borderRadius: 24,
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  padding: 24,
  display: "grid",
  gap: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
};

const roleIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
};

const roleTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0F172A",
};

const roleSubtitleStyle: CSSProperties = {
  marginTop: -6,
  fontSize: 13,
  color: "#64748B",
  lineHeight: 1.7,
};

const roleBulletListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minHeight: 120,
};

const roleBulletStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.7,
};

const roleBulletDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  marginTop: 7,
  flexShrink: 0,
};

const roleLinkStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 999,
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
};

const featureGridStyle: CSSProperties = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const featureCardStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: 22,
  display: "grid",
  gap: 12,
};

const featureIconWrapStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  display: "grid",
  placeItems: "center",
  color: "#3157B7",
};

const featureTitleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#0F172A",
};

const featureBodyTextStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.75,
  color: "#475569",
};

const pricingLeadStyle: CSSProperties = {
  margin: "14px 0 0",
  maxWidth: 760,
  fontSize: 15,
  lineHeight: 1.8,
  color: "#475569",
};

const pricingGridStyle: CSSProperties = {
  marginTop: 24,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

const pricingCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: 24,
  display: "grid",
  gap: 10,
};

const pricingTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};

const pricingPriceStyle: CSSProperties = {
  fontSize: 34,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: "-0.05em",
};

const pricingNoteStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
};

const pricingFeatureListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  paddingTop: 10,
};

const pricingFeatureItemStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13,
  lineHeight: 1.7,
};

const pricingFeatureDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  marginTop: 7,
  flexShrink: 0,
};

const futureBoxStyle: CSSProperties = {
  marginTop: 20,
  borderRadius: 20,
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  padding: 20,
  display: "grid",
  gap: 10,
};

const futureBoxTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0F172A",
};

const futureBoxBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.85,
  color: "#475569",
};
