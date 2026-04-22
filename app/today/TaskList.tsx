"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { DailyTask } from "@/lib/types";

const SUBJECT_EMOJI: Record<string, string> = {
  math: "📐", physics: "⚡", chemistry: "🧪", biology: "🌿",
  english: "📖", japanese: "📝", world_history: "🌍", japanese_history: "🏯",
  geography: "🗾", civics: "🏛️", information: "💻", other: "📚",
};

export default function TaskList({ tasks }: { tasks: DailyTask[] }) {
  const [statuses, setStatuses] = useState<Record<string, DailyTask["status"]>>(
    Object.fromEntries(tasks.map((t) => [t.id, t.status]))
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const router = useRouter();

  const handleToggle = async (task: DailyTask) => {
    const current = statuses[task.id];
    const next: DailyTask["status"] = current === "done" ? "pending" : "done";
    setUpdating(task.id);

    const supabase = createClient();
    await supabase
      .from("daily_tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    setStatuses((prev) => ({ ...prev, [task.id]: next }));
    setUpdating(null);
    router.refresh();
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {tasks.map((task, i) => {
        const status = statuses[task.id];
        const isDone = status === "done";
        const book = task.books as { title: string; subject: string } | undefined;
        const emoji = SUBJECT_EMOJI[book?.subject ?? "math"];

        return (
          <div key={task.id} style={{
            padding: "16px",
            borderBottom: i === tasks.length - 1 ? "none" : "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: isDone ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}>
            {/* チェックボタン */}
            <button
              onClick={() => handleToggle(task)}
              disabled={updating === task.id}
              style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                border: `2px solid ${isDone ? "var(--success)" : "var(--border)"}`,
                background: isDone ? "var(--success)" : "transparent",
                cursor: updating === task.id ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {isDone && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
            </button>

            {/* 内容 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 14, fontWeight: 600,
                color: isDone ? "var(--text-muted)" : "var(--text-primary)",
                textDecoration: isDone ? "line-through" : "none",
              }}>
                {emoji} {book?.title ?? "教材"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                例題 {task.problem_no_start}〜{task.problem_no_end}番
              </p>
            </div>

            {/* 問題数バッジ */}
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6, padding: "2px 8px",
              flexShrink: 0,
            }}>
              {task.problem_no_end - task.problem_no_start + 1}問
            </span>
          </div>
        );
      })}
    </div>
  );
}
