import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  MessageSquareText,
  Route,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: student } = await supabase
      .from("students").select("onboarding_done").eq("user_id", user.id).maybeSingle();
    if (!student || !student.onboarding_done) redirect("/onboarding");
    redirect("/schedule");
  }

  return (
    <div style={pageStyle}>

      {/* ── Header ── */}
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoStyle}>
            <div style={logoBadgeStyle}>AI</div>
            <span style={logoTextStyle}>永愛塾</span>
          </Link>
          <div style={headerActionsStyle}>
            <Link href="/login?mode=signin" style={ghostBtnStyle}>ログイン</Link>
            <Link href="/login?mode=signup" style={primaryBtnStyle}>
              無料ではじめる
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={heroStyle}>
        <div style={heroInnerStyle}>
          <p style={heroCatchStyle}>AIが毎日の自習をサポートする</p>
          <h1 style={heroTitleStyle}>
            受験勉強を、<br />
            続けやすくする。
          </h1>
          <p style={heroSubStyle}>
            志望校・レベルに合ったルートを自動生成。<br />
            今日やることが見えて、分からない問題はすぐ質問。
          </p>

          {/* feature icon row — like vibely */}
          <div style={featureRowStyle}>
            {[
              { icon: <BrainCircuit size={22} />, label: "AI面談" },
              { icon: <Route size={22} />, label: "学習ルート" },
              { icon: <CalendarCheck2 size={22} />, label: "タスク管理" },
              { icon: <MessageSquareText size={22} />, label: "AI質問" },
            ].map((f) => (
              <div key={f.label} style={featurePillStyle}>
                <div style={featurePillIconStyle}>{f.icon}</div>
                <span style={featurePillLabelStyle}>{f.label}</span>
              </div>
            ))}
          </div>

          <Link href="/login?mode=signup" style={ctaBtnStyle}>
            無料ではじめる <ArrowRight size={15} />
          </Link>
          <p style={ctaNoteStyle}>クレジットカード登録不要</p>
        </div>
      </section>

      {/* ── Product visual ── */}
      <section style={productSectionStyle}>
        <div style={productInnerStyle}>
          <p style={sectionEyebrowStyle}>All in one</p>
          <h2 style={productTitleStyle}>学習に必要なものが、ひとつに。</h2>
          <div style={productMockStyle}>
            <div style={mockHeaderStyle}>
              <div style={mockDotStyle("#EF4444")} />
              <div style={mockDotStyle("#F59E0B")} />
              <div style={mockDotStyle("#22C55E")} />
              <span style={mockUrlStyle}>eijuku.app / schedule</span>
            </div>
            <div style={mockBodyStyle}>
              {/* Left sidebar */}
              <div style={mockSidebarStyle}>
                {["今日", "スケジュール", "My先生", "ルート", "本棚", "演習", "進捗", "タイムライン"].map((item, i) => (
                  <div key={item} style={{ ...mockNavItemStyle, background: i === 0 ? "#F1F5F9" : "transparent", fontWeight: i === 0 ? 800 : 600 }}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div style={mockMainStyle}>
                <div style={mockGreetStyle}>おはようございます 👋</div>
                <div style={mockTodayStyle}>
                  <div style={mockTodaySectionStyle}>
                    <div style={mockTodayLabelStyle}>今日のタスク</div>
                    {[
                      { title: "基礎問題精講 数学IA", range: "p.40〜52", done: true },
                      { title: "システム英単語", range: "101〜200番", done: true },
                      { title: "物理のエッセンス", range: "第3章", done: false },
                    ].map((t) => (
                      <div key={t.title} style={mockTaskRowStyle}>
                        <div style={{ ...mockTaskCheckStyle, background: t.done ? "#1E293B" : "#fff" }}>
                          {t.done && <CheckCircle2 size={11} color="#fff" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.done ? "#94A3B8" : "#1E293B", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.range}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={mockStatColStyle}>
                    <div style={mockStatCardStyle}>
                      <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>連続学習</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#1E293B", letterSpacing: "-0.04em" }}>7<span style={{ fontSize: 14 }}>日</span></div>
                    </div>
                    <div style={mockStatCardStyle}>
                      <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>今週の進捗</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#1E293B", letterSpacing: "-0.04em" }}>84<span style={{ fontSize: 14 }}>%</span></div>
                    </div>
                    <div style={{ ...mockStatCardStyle, background: "#1E293B" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>MY先生</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginTop: 4 }}>
                        「今日も2問完了！このペースで行こう 💪」
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ ...sectionStyle, background: "#F7F7F5" }}>
        <div style={sectionInnerStyle}>
          <p style={sectionEyebrowStyle}>Features</p>
          <h2 style={sectionH2Style}>自習で困りやすい場面を、まるごとカバー</h2>
          <div style={featuresGridStyle}>
            {[
              { icon: <BrainCircuit size={20} />, title: "AI面談・ルート生成", body: "登録直後にAIが学力・志望校・悩みをヒアリング。今の状態に合った学習ルートを自動で作ります。" },
              { icon: <CalendarCheck2 size={20} />, title: "今日のタスク管理", body: "スケジュール・進捗・未消化タスクが一目でわかります。何から始めるか迷いません。" },
              { icon: <MessageSquareText size={20} />, title: "いつでもAI質問", body: "問題を送るだけで即解説。解き方・次に見直す点まで丁寧に返します。" },
              { icon: <Sparkles size={20} />, title: "My先生（AIコーチ）", body: "学習記録をもとに毎日声をかけてくれます。不安な時も止まりそうな時も一緒に進めます。" },
              { icon: <Route size={20} />, title: "参考書ルート", body: "武田塾ルートをベースに、志望校レベルに合わせて何をいつやるかが見える状態を作ります。" },
              { icon: <Trophy size={20} />, title: "XP・ランキング", body: "演習のたびにXPが積み上がります。バッジ・ランキングで頑張りが目に見えます。" },
            ].map((f) => (
              <div key={f.title} style={fCardStyle}>
                <div style={fIconStyle}>{f.icon}</div>
                <div style={fTitleStyle}>{f.title}</div>
                <div style={fBodyStyle}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How ── */}
      <section id="how" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={sectionEyebrowStyle}>How it starts</p>
          <h2 style={sectionH2Style}>はじめる時の流れ</h2>
          <div style={stepsGridStyle}>
            {[
              { step: "01", title: "アカウント登録", body: "Google またはメールアドレスで、すぐ始められます。クレジットカード不要。" },
              { step: "02", title: "AI面談", body: "今の学力・志望校・悩みを会話で整理。自分に合う進め方が見えてきます。" },
              { step: "03", title: "ルート確認", body: "次に何をやるかが決まった状態で学習スタート。迷う時間がなくなります。" },
              { step: "04", title: "毎日続ける", body: "My先生・タスク・質問がつながっていて、自習が途切れにくくなります。" },
            ].map((s, i) => (
              <div key={s.step} style={stepCardStyle}>
                <div style={stepNumStyle}>{s.step}</div>
                {i < 3 && <div style={stepArrowStyle}><ArrowRight size={13} /></div>}
                <div style={stepTitleStyle}>{s.title}</div>
                <div style={stepBodyStyle}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ ...sectionStyle, background: "#F7F7F5" }}>
        <div style={sectionInnerStyle}>
          <p style={sectionEyebrowStyle}>Pricing</p>
          <h2 style={sectionH2Style}>シンプルな料金体系</h2>
          <p style={sectionDescStyle}>まずは無料で試せます。必要になったら、自分に合うプランに切り替えてください。</p>
          <div style={pricingGridStyle}>
            <PricingCard name="無料プラン" price="¥0" period="ずっと無料" features={["AI面談・ルート生成", "学習スケジュール管理", "演習記録・進捗確認", "XP・バッジ・ランキング"]} highlight={false} />
            <PricingCard name="AIパートナー" price="¥3,480" period="/ 月（税込）" features={["無料プランの全機能", "AI質問（月30回）", "My先生コーチング", "週次セッション", "優先サポート"]} highlight={false} />
            <PricingCard name="永愛塾プラン" price="¥7,980" period="/ 月（税込）" badge="おすすめ" features={["AIパートナーの全機能", "AI質問 無制限", "模試成績管理", "詳細学習分析", "専任コーチサポート"]} highlight={true} />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={ctaSectionStyle}>
        <div style={ctaInnerStyle}>
          <Zap size={28} style={{ color: "#1E293B", marginBottom: 20 }} />
          <h2 style={ctaTitleStyle}>まず無料で、今日から始めてみる。</h2>
          <p style={ctaDescStyle}>登録は1分。AI面談から、今日の自習がすぐ始まります。</p>
          <Link href="/login?mode=signup" style={ctaBtnStyle}>
            無料ではじめる <ArrowRight size={15} />
          </Link>
          <p style={ctaNoteStyle}>クレジットカード登録不要</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <Link href="/" style={{ ...logoStyle, textDecoration: "none" }}>
            <div style={{ ...logoBadgeStyle, width: 28, height: 28, fontSize: 10 }}>AI</div>
            <span style={{ ...logoTextStyle, fontSize: 14 }}>永愛塾</span>
          </Link>
          <div style={footerLinksStyle}>
            <a href="#features" style={footerLinkStyle}>特徴</a>
            <a href="#how" style={footerLinkStyle}>使い方</a>
            <a href="#pricing" style={footerLinkStyle}>料金</a>
          </div>
          <span style={footerCopyStyle}>© 2026 永愛塾</span>
        </div>
      </footer>

    </div>
  );
}

// ─── Sub components ───────────────────────────────────────────────────────────

function PricingCard({ name, price, period, features, highlight, badge }: {
  name: string; price: string; period: string;
  features: string[]; highlight: boolean; badge?: string;
}) {
  return (
    <div style={{
      borderRadius: 22, padding: "28px 26px",
      background: highlight ? "#1E293B" : "#fff",
      border: highlight ? "none" : "1px solid #E8E8E4",
    }}>
      {badge && (
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#F1F5F9", color: "#64748B", fontSize: 11, fontWeight: 800, marginBottom: 14 }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 900, color: highlight ? "#fff" : "#1E293B", marginBottom: 8 }}>{name}</div>
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.05em", color: highlight ? "#fff" : "#1E293B" }}>{price}</div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>{period}</div>
      <div style={{ height: 1, background: highlight ? "rgba(255,255,255,0.08)" : "#F1F5F9", margin: "18px 0" }} />
      {features.map((f) => (
        <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
          <CheckCircle2 size={13} style={{ color: highlight ? "#64748B" : "#94A3B8", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: highlight ? "rgba(255,255,255,0.78)" : "#475569" }}>{f}</span>
        </div>
      ))}
      <Link href="/login?mode=signup" style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        marginTop: 22, minHeight: 46, borderRadius: 999,
        background: highlight ? "#fff" : "#2563EB",
        color: highlight ? "#2563EB" : "#fff",
        fontSize: 13, fontWeight: 900,
      }}>
        はじめる <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function mockDotStyle(color: string): CSSProperties {
  return { width: 10, height: 10, borderRadius: 999, background: color };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#fff", color: "#1E293B" };

// Header
const headerStyle: CSSProperties = {
  position: "sticky", top: 0, zIndex: 100,
  background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)",
  borderBottom: "1px solid #F1F5F9",
};
const headerInnerStyle: CSSProperties = {
  maxWidth: 1080, margin: "0 auto", padding: "0 24px",
  height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
};
const logoStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 9, color: "inherit", textDecoration: "none" };
const logoBadgeStyle: CSSProperties = {
  width: 34, height: 34, borderRadius: 9, background: "#1E293B",
  color: "#fff", fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center",
};
const logoTextStyle: CSSProperties = { fontSize: 16, fontWeight: 900, color: "#1E293B" };
const headerActionsStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const ghostBtnStyle: CSSProperties = {
  padding: "8px 16px", borderRadius: 999, border: "1px solid #E2E8F0",
  fontSize: 13, fontWeight: 700, color: "#64748B",
};
const primaryBtnStyle: CSSProperties = {
  padding: "8px 18px", borderRadius: 999, background: "#2563EB",
  fontSize: 13, fontWeight: 800, color: "#fff",
};

// Hero — centered like vibely
const heroStyle: CSSProperties = {
  padding: "100px 24px 90px",
  textAlign: "center",
  borderBottom: "1px solid #F1F5F9",
};
const heroInnerStyle: CSSProperties = { maxWidth: 680, margin: "0 auto" };
const heroCatchStyle: CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#94A3B8", margin: "0 0 20px",
};
const heroTitleStyle: CSSProperties = {
  fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.04,
  letterSpacing: "-0.055em", color: "#0F172A", margin: "0 0 22px",
};
const heroSubStyle: CSSProperties = {
  fontSize: 16, lineHeight: 1.85, color: "#64748B", margin: "0 0 40px",
};

// Feature icon row
const featureRowStyle: CSSProperties = {
  display: "flex", justifyContent: "center", gap: 12,
  flexWrap: "wrap", marginBottom: 40,
};
const featurePillStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "10px 18px", borderRadius: 999,
  border: "1px solid #E8E8E4", background: "#FAFAFA",
};
const featurePillIconStyle: CSSProperties = { color: "#2563EB" };
const featurePillLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#1E293B" };

// CTA (shared)
const ctaBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  minHeight: 52, padding: "0 28px", borderRadius: 999,
  background: "#2563EB", color: "#fff", fontSize: 15, fontWeight: 900,
};
const ctaNoteStyle: CSSProperties = { fontSize: 12, color: "#94A3B8", marginTop: 12 };

// Product visual section
const productSectionStyle: CSSProperties = { padding: "80px 24px", borderBottom: "1px solid #F1F5F9" };
const productInnerStyle: CSSProperties = { maxWidth: 1080, margin: "0 auto" };
const sectionEyebrowStyle: CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "#94A3B8", margin: "0 0 10px",
};
const productTitleStyle: CSSProperties = {
  fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 900,
  letterSpacing: "-0.04em", color: "#0F172A", margin: "0 0 32px",
};

// Mock UI
const productMockStyle: CSSProperties = {
  borderRadius: 18, overflow: "hidden",
  border: "1px solid #E2E8F0",
  boxShadow: "0 24px 80px rgba(15,23,42,0.1)",
};
const mockHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "10px 16px", background: "#F8FAFC",
  borderBottom: "1px solid #E2E8F0",
};
const mockUrlStyle: CSSProperties = { fontSize: 11, color: "#94A3B8", marginLeft: 10 };
const mockBodyStyle: CSSProperties = { display: "flex", height: 340 };
const mockSidebarStyle: CSSProperties = {
  width: 120, padding: "16px 8px", background: "#FAFAFA",
  borderRight: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 2,
};
const mockNavItemStyle: CSSProperties = {
  padding: "7px 10px", borderRadius: 8,
  fontSize: 12, color: "#475569",
};
const mockMainStyle: CSSProperties = { flex: 1, padding: "20px 24px", overflow: "hidden" };
const mockGreetStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 16 };
const mockTodayStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 180px", gap: 16, height: "100%" };
const mockTodaySectionStyle: CSSProperties = {};
const mockTodayLabelStyle: CSSProperties = { fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 };
const mockTaskRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 10px", borderRadius: 10, marginBottom: 4,
  background: "#F8FAFC", border: "1px solid #F1F5F9",
};
const mockTaskCheckStyle: CSSProperties = {
  width: 18, height: 18, borderRadius: 999,
  border: "1.5px solid #CBD5E1", display: "grid", placeItems: "center", flexShrink: 0,
};
const mockStatColStyle: CSSProperties = { display: "grid", gap: 10, alignContent: "start" };
const mockStatCardStyle: CSSProperties = {
  borderRadius: 12, padding: "12px 14px",
  background: "#F8FAFC", border: "1px solid #F1F5F9",
};

// Sections
const sectionStyle: CSSProperties = { padding: "80px 24px" };
const sectionInnerStyle: CSSProperties = { maxWidth: 1080, margin: "0 auto" };
const sectionH2Style: CSSProperties = {
  fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 900,
  letterSpacing: "-0.04em", color: "#0F172A", margin: "0 0 36px",
};
const sectionDescStyle: CSSProperties = { fontSize: 15, lineHeight: 1.8, color: "#64748B", margin: "-24px 0 40px", maxWidth: 540 };

// Features grid
const featuresGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12,
};
const fCardStyle: CSSProperties = {
  borderRadius: 18, border: "1px solid #E8E8E4",
  padding: "22px 20px 24px", background: "#fff",
};
const fIconStyle: CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: "#F1F5F9", color: "#475569",
  display: "grid", placeItems: "center", marginBottom: 14,
};
const fTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8 };
const fBodyStyle: CSSProperties = { fontSize: 13, lineHeight: 1.8, color: "#64748B" };

// Steps
const stepsGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, position: "relative",
};
const stepCardStyle: CSSProperties = {
  borderRadius: 18, border: "1px solid #E8E8E4",
  padding: "22px 18px", background: "#F7F7F5", position: "relative",
};
const stepNumStyle: CSSProperties = {
  fontSize: 30, fontWeight: 900, letterSpacing: "-0.06em", color: "#E2E8F0", marginBottom: 10,
};
const stepArrowStyle: CSSProperties = {
  position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)",
  width: 18, height: 18, borderRadius: 999, background: "#fff",
  border: "1px solid #E2E8F0", display: "grid", placeItems: "center", color: "#CBD5E1", zIndex: 1,
};
const stepTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8 };
const stepBodyStyle: CSSProperties = { fontSize: 13, lineHeight: 1.8, color: "#64748B" };

// Pricing
const pricingGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, alignItems: "start",
};

// CTA section — centered like vibely hero
const ctaSectionStyle: CSSProperties = {
  padding: "100px 24px",
  textAlign: "center",
  borderTop: "1px solid #F1F5F9",
};
const ctaInnerStyle: CSSProperties = { maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" };
const ctaTitleStyle: CSSProperties = {
  fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900,
  letterSpacing: "-0.04em", color: "#0F172A", margin: "0 0 14px",
};
const ctaDescStyle: CSSProperties = { fontSize: 15, color: "#64748B", margin: "0 0 28px", lineHeight: 1.8 };

// Footer
const footerStyle: CSSProperties = { borderTop: "1px solid #F1F5F9", padding: "24px" };
const footerInnerStyle: CSSProperties = {
  maxWidth: 1080, margin: "0 auto",
  display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
};
const footerLinksStyle: CSSProperties = { display: "flex", gap: 20, flex: 1 };
const footerLinkStyle: CSSProperties = { fontSize: 12, color: "#94A3B8", fontWeight: 700, textDecoration: "none" };
const footerCopyStyle: CSSProperties = { fontSize: 12, color: "#CBD5E1" };
