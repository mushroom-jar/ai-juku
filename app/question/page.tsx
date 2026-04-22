"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import { Camera } from "lucide-react";

export default function QuestionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-sensei?mode=question");
  }, [router]);

  return (
    <AppLayout>
      <div style={{ minHeight: "calc(100dvh - 64px)", display: "grid", placeItems: "center", padding: "24px 16px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: 24,
            padding: "28px 24px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148,163,184,0.14)",
            boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              margin: "0 auto 14px",
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              background: "#FFF1F3",
              color: "#BE185D",
            }}
          >
            <Camera size={22} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>質問モードへ移動しています</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "#6B7280" }}>
            これからは My先生 の中で、文字でも写真でも質問できるようになっています。
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
