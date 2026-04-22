"use client";

import { useState } from "react";
import { Library, MinusCircle } from "lucide-react";

export default function SkipButton({
  routeId,
  bookId,
  isActive,
  onDone,
}: {
  routeId: string;
  bookId: string;
  isActive: boolean;
  onDone?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);

    if (!isActive) {
      // 本棚に追加 ＋ ルートをin_progressに
      await Promise.all([
        fetch("/api/shelf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId }),
        }),
        fetch("/api/route-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId, status: "in_progress" }),
        }),
      ]);
    } else {
      // 解除（本棚からは削除しない）
      await fetch("/api/route-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, status: "not_started" }),
      });
    }

    setLoading(false);
    onDone?.();
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px 3px 7px",
        borderRadius: 99,
        border: isActive
          ? "1px solid #C4CEEA"
          : "1px solid #3B52B4",
        background: isActive ? "#F3F4F6" : "#EEF1F8",
        color: isActive ? "#6B7280" : "#3B52B4",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        display: "flex", alignItems: "center", gap: 4,
        whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
    >
      {loading ? (
        "..."
      ) : isActive ? (
        <><MinusCircle size={11} strokeWidth={2.5} /> 解除する</>
      ) : (
        <><Library size={11} strokeWidth={2.5} /> 本棚に追加</>
      )}
    </button>
  );
}
