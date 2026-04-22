import type { Metadata } from "next";
import "./globals.css";
import { TimerProvider } from "./components/TimerContext";

export const metadata: Metadata = {
  title: "永愛塾 | AIが毎日の自習をサポートする学習塾",
  description: "AI面談、学習記録、タイムライン、My先生で毎日の自習を支える永愛塾。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <TimerProvider>{children}</TimerProvider>
      </body>
    </html>
  );
}
