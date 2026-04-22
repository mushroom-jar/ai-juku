"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/schedule",  label: "予定", icon: "📅" },
  { href: "/practice",  label: "演習", icon: "⏱️" },
  { href: "/progress",  label: "記録", icon: "📈" },
  { href: "/question",  label: "質問", icon: "📷" },
  { href: "/settings",  label: "設定", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      background: "#fff",
      borderTop: "1px solid #E4E7EC",
      display: "flex",
      zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              textDecoration: "none",
              color: active ? "#3B52B4" : "#98A2B3",
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              letterSpacing: 0.2,
            }}>
              {tab.label}
            </span>
            {active && (
              <span style={{
                position: "absolute",
                bottom: 0,
                width: 24,
                height: 3,
                background: "#3B52B4",
                borderRadius: "3px 3px 0 0",
              }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
