"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  History,
  Library,
  LineChart,
  Map,
  RotateCcw,
  Settings,
} from "lucide-react";
import XpBar from "./XpBar";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  tone: {
    color: string;
    bg: string;
    border: string;
  };
};

type Section = {
  title: string | null;
  tabs: Tab[];
};

const TONE = { color: "#1E293B", bg: "rgba(30,41,59,0.07)", border: "rgba(30,41,59,0.1)" };

const NAV_SECTIONS: Section[] = [
  {
    title: null,
    tabs: [
      { href: "/schedule", label: "ホーム", Icon: Home, tone: TONE },
      { href: "/shelf", label: "本棚", Icon: Library, tone: TONE },
    ],
  },
  {
    title: "学習する",
    tabs: [
      { href: "/progress", label: "成績・課題", Icon: LineChart, tone: TONE },
      { href: "/timeline", label: "タイムライン", Icon: Activity, tone: TONE },
      { href: "/events", label: "カレンダー", Icon: CalendarDays, tone: TONE },
    ],
  },
  {
    title: "整える",
    tabs: [
      { href: "/route", label: "学習ルート", Icon: Map, tone: TONE },
      { href: "/reflection", label: "振り返る", Icon: History, tone: TONE },
      { href: "/review", label: "復習リスト", Icon: RotateCcw, tone: TONE },
      { href: "/books", label: "教材", Icon: BookOpen, tone: TONE },
    ],
  },
  {
    title: null,
    tabs: [{ href: "/settings", label: "設定", Icon: Settings, tone: TONE }],
  },
];

const MOBILE_TABS: Tab[] = [
  { href: "/schedule", label: "ホーム", Icon: Home, tone: { color: "#3157B7", bg: "", border: "" } },
  { href: "/shelf", label: "本棚", Icon: Library, tone: { color: "#0F766E", bg: "", border: "" } },
  { href: "/progress", label: "成績", Icon: LineChart, tone: { color: "#B45309", bg: "", border: "" } },
  { href: "/events", label: "予定", Icon: CalendarDays, tone: { color: "#7C3AED", bg: "", border: "" } },
  { href: "/my-sensei", label: "先生", Icon: GraduationCap, tone: { color: "#3157B7", bg: "", border: "" } },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/schedule" && pathname.startsWith(href));
}


export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const senseiActive = pathname === "/my-sensei";

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
          <Link href="/my-sensei" className={`sidebar-sensei ${senseiActive ? "is-active" : ""}`}>
            <span className="sidebar-sensei-icon">
              <GraduationCap size={18} strokeWidth={2.2} />
            </span>
            <span className="sidebar-sensei-copy">
              <span className="sidebar-sensei-title">My先生</span>
            </span>
          </Link>

          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.title ?? `section-${sectionIndex}`} className="sidebar-section">
              {sectionIndex > 0 && <div className="sidebar-divider" />}
              {section.title ? <div className="sidebar-section-title">{section.title}</div> : null}

              {section.tabs.map(({ href, label, Icon, tone }) => {
                const active = isActive(pathname, href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-item ${active ? "is-active" : ""}`}
                    style={
                      {
                        "--item-accent": tone.color,
                        "--item-accent-bg": tone.bg,
                        "--item-accent-border": tone.border,
                      } as CSSProperties
                    }
                  >
                    <span className="sidebar-item-icon">
                      <Icon size={18} strokeWidth={active ? 2.4 : 2.1} />
                    </span>
                    <span className="sidebar-item-copy">
                      <span className="sidebar-item-label">{label}</span>
                    </span>
                    {active ? <span className="sidebar-item-dot" /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">© 2026 永愛塾</div>
      </aside>

      <main className="app-main">
        <XpBar />
        {children}
      </main>

      <nav className="bottom-nav">
        {MOBILE_TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);

          return (
            <Link key={href} href={href} className={`bottom-nav-item ${active ? "is-active" : ""}`}>
              <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
