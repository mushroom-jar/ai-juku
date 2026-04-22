"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateScheduleButton({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    const res = await fetch("/api/schedule-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.error === "no active route") {
        setError("進行中のルートがありません。ルートを確認してください。");
      } else {
        setError("スケジュールの生成に失敗しました。");
      }
      return;
    }

    router.refresh();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: "13px 28px",
          background: loading ? "var(--bg-elevated)" : "linear-gradient(135deg, #3B52B4, #5B73D4)",
          color: loading ? "var(--text-muted)" : "#fff",
          border: "none",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 4px 12px rgba(59,82,180,0.25)",
        }}
      >
        {loading ? "生成中..." : "✨ 今週のスケジュールを作成"}
      </button>
      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{error}</p>
      )}
    </div>
  );
}
