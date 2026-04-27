"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  GraduationCap,
  Settings2,
  Timer,
  CheckSquare,
  User,
  Users,
  BadgeCheck,
  Trophy,
  History,
  Settings,
  X,
} from "lucide-react";
import XpBar from "./XpBar";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  tone: { color: string; bg: string; border: string };
};

const MOBILE_TABS: Tab[] = [
  { href: "/todo",      label: "ホーム", Icon: CheckSquare,   tone: { color: "#3157B7", bg: "", border: "" } },
  { href: "/exercise",  label: "演習",  Icon: BookOpen,      tone: { color: "#0F766E", bg: "", border: "" } },
  { href: "/timer",     label: "タイマー", Icon: Timer,      tone: { color: "#7C3AED", bg: "", border: "" } },
  { href: "/my-sensei", label: "先生",  Icon: GraduationCap, tone: { color: "#EA580C", bg: "", border: "" } },
];

// 自分シートの項目
const ME_ITEMS = [
  { href: "/me",        label: "プロフィール", Icon: User,       color: "#3157B7", bg: "#EFF6FF" },
  { href: "/reflection",label: "振り返り",     Icon: History,    color: "#D97706", bg: "#FFFBEB" },
  { href: "/badges",    label: "バッジ",       Icon: BadgeCheck, color: "#059669", bg: "#F0FDF4" },
  { href: "/ranking",   label: "ランキング",   Icon: Trophy,     color: "#7C3AED", bg: "#F5F3FF" },
  { href: "/friends",   label: "フレンド",     Icon: Users,      color: "#0F766E", bg: "#F0FDFA" },
  { href: "/settings",  label: "設定",         Icon: Settings2,  color: "#475569", bg: "#F8FAFC" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/schedule" && pathname.startsWith(href));
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [meOpen, setMeOpen] = useState(false);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="sidebar-brand-mark">
            <BookOpen size={17} color="#fff" strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand-copy" style={{ flex: 1 }}>
            <div className="sidebar-brand-title">永愛塾</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {MOBILE_TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={`sidebar-item ${active ? "is-active" : ""}`}>
                <span className="sidebar-item-icon"><Icon size={18} strokeWidth={active ? 2.4 : 2.1} /></span>
                <span className="sidebar-item-copy"><span className="sidebar-item-label">{label}</span></span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">© 2026 永愛塾</div>
      </aside>

      <main className="app-main">
        <XpBar />
        {children}
      </main>

      {/* ── モバイル ボトムナビ ── */}
      <nav className="bottom-nav">
        {MOBILE_TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={`bottom-nav-item ${active ? "is-active" : ""}`}>
              <Icon size={23} strokeWidth={active ? 2.4 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* 「自分」ボタン */}
        <button
          onClick={() => setMeOpen(true)}
          className="bottom-nav-item"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <User size={23} strokeWidth={1.8} />
          <span>自分</span>
        </button>
      </nav>

      {/* ── 自分シート ── */}
      {meOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div onClick={() => setMeOpen(false)} style={overlayStyle} />

          {/* シート本体 */}
          <div style={sheetStyle}>
            <div style={sheetHandleStyle} />

            <div style={sheetHeaderStyle}>
              <p style={sheetTitleStyle}>メニュー</p>
              <button onClick={() => setMeOpen(false)} style={closeSheetBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={sheetGridStyle}>
              {ME_ITEMS.map(({ href, label, Icon, color, bg }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMeOpen(false)}
                  style={sheetItemStyle}
                >
                  <div style={{ ...sheetIconStyle, background: bg, color }}>
                    <Icon size={22} strokeWidth={1.9} />
                  </div>
                  <span style={sheetItemLabelStyle}>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── スタイル ──────────────────────────────────
const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 200,
};

const sheetStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  // 画面の上部 15% から始まる（85% の高さ）
  top: "15%",
  zIndex: 201,
  background: "#F2F2F7",
  borderRadius: "22px 22px 0 0",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  animation: "slideUp 0.25s ease",
};

const sheetHandleStyle: CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 999,
  background: "#D0D5DD",
  margin: "10px auto 0",
  flexShrink: 0,
};

const sheetHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 20px 8px",
  flexShrink: 0,
};

const sheetTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  color: "#0F172A",
};

const closeSheetBtnStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  background: "#E2E8F0",
  color: "#475569",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const sheetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
  padding: "10px 18px 40px",
  overflowY: "auto",
};

const sheetItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "20px 8px",
  borderRadius: 20,
  background: "#FFFFFF",
  textDecoration: "none",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const sheetIconStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
};

const sheetItemLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0F172A",
  textAlign: "center",
};
