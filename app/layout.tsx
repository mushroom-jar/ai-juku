import type { Metadata } from "next";
import { Noto_Sans_JP, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TimerProvider } from "./components/TimerContext";
import PwaRegister from "./components/PwaRegister";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "永愛塾 | AIが毎日の自習をサポートする学習塾",
  description: "AI面談、学習記録、タイムライン、My先生で毎日の自習を支える永愛塾。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${jakarta.variable} ${notoJP.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B52B4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="永愛塾" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        <TimerProvider>{children}</TimerProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
