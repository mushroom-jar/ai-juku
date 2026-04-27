"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppLayout from "@/app/components/AppLayout";
import { Pause, Play, RefreshCw, SkipForward } from "lucide-react";

type Mode = "pomodoro" | "shortbreak" | "longbreak" | "stopwatch" | "custom";

const MODES: { value: Mode; label: string; defaultSec: number | null; color: string }[] = [
  { value: "pomodoro",   label: "ポモドーロ",  defaultSec: 25 * 60, color: "#3157B7" },
  { value: "shortbreak", label: "短い休憩",    defaultSec: 5 * 60,  color: "#0F766E" },
  { value: "longbreak",  label: "長い休憩",    defaultSec: 15 * 60, color: "#7C3AED" },
  { value: "stopwatch",  label: "ストップウォッチ", defaultSec: null, color: "#EA580C" },
  { value: "custom",     label: "カスタム",    defaultSec: 10 * 60, color: "#64748B" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtSec(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export default function TimerPage() {
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState("10");
  const [pomCount, setPomCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeInfo = MODES.find(m => m.value === mode)!;

  function initMode(m: Mode) {
    setMode(m);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const info = MODES.find(x => x.value === m)!;
    if (m === "custom") {
      setSeconds((parseInt(customMin) || 10) * 60);
    } else if (m === "stopwatch") {
      setSeconds(0);
    } else {
      setSeconds(info.defaultSec!);
    }
  }

  function applyCustom() {
    if (mode === "custom") setSeconds((parseInt(customMin) || 10) * 60);
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (mode === "stopwatch") return s + 1;
          if (s <= 1) {
            setRunning(false);
            if (mode === "pomodoro") setPomCount(c => c + 1);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const isCountdown = mode !== "stopwatch";
  const total = mode === "pomodoro" ? 25 * 60 : mode === "shortbreak" ? 5 * 60 : mode === "longbreak" ? 15 * 60 : mode === "custom" ? (parseInt(customMin) || 10) * 60 : null;
  const progress = (total && isCountdown) ? 1 - seconds / total : null;

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={innerStyle}>
          <h1 style={titleStyle}>タイマー</h1>

          {/* モード選択 */}
          <div style={modeRowStyle}>
            {MODES.map(m => (
              <button key={m.value} onClick={() => initMode(m.value)} style={{
                ...modeBtnStyle,
                background: mode === m.value ? m.color : "transparent",
                color: mode === m.value ? "#fff" : "#64748B",
                fontWeight: mode === m.value ? 800 : 600,
              }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* カスタム入力 */}
          {mode === "custom" && (
            <div style={customRowStyle}>
              <input
                type="number"
                value={customMin}
                onChange={e => setCustomMin(e.target.value)}
                onBlur={applyCustom}
                min={1}
                max={180}
                style={customInputStyle}
              />
              <span style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>分</span>
            </div>
          )}

          {/* タイマー本体 */}
          <div style={timerCardStyle}>
            {/* 円形プログレス */}
            <div style={ringWrapStyle}>
              <svg width={220} height={220} style={{ position: "absolute", top: 0, left: 0 }}>
                <circle cx={110} cy={110} r={96} fill="none" stroke="#F1F5F9" strokeWidth={8} />
                {progress !== null && (
                  <circle
                    cx={110} cy={110} r={96}
                    fill="none"
                    stroke={modeInfo.color}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 96}`}
                    strokeDashoffset={`${2 * Math.PI * 96 * (1 - progress)}`}
                    transform="rotate(-90 110 110)"
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                )}
              </svg>
              <div style={timerDisplayStyle}>
                <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A", lineHeight: 1 }}>
                  {fmtSec(seconds)}
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 6, fontWeight: 600 }}>
                  {modeInfo.label}
                </div>
              </div>
            </div>

            {/* ポモドーロカウント */}
            {mode === "pomodoro" && (
              <div style={pomRowStyle}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ ...pomDotStyle, background: i < pomCount % 4 ? modeInfo.color : "#E2E8F0" }} />
                ))}
                <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>×{Math.floor(pomCount / 4) || ""}</span>
              </div>
            )}

            {/* コントロール */}
            <div style={controlRowStyle}>
              <button onClick={() => initMode(mode)} style={subBtnStyle}>
                <RefreshCw size={20} />
              </button>
              <button onClick={() => setRunning(r => !r)} style={{ ...mainBtnStyle, background: modeInfo.color }}>
                {running ? <Pause size={28} fill="#fff" /> : <Play size={28} fill="#fff" />}
              </button>
              {mode === "pomodoro" && (
                <button onClick={() => initMode("shortbreak")} style={subBtnStyle}>
                  <SkipForward size={20} />
                </button>
              )}
              {mode !== "pomodoro" && <div style={{ width: 52 }} />}
            </div>
          </div>

          {/* ガイド */}
          <div style={guideCardStyle}>
            <div style={guideTitleStyle}>ポモドーロテクニック</div>
            <div style={guideBodyStyle}>
              25分集中 → 5分休憩を繰り返す。4セット終えたら15分の長い休憩を取りましょう。
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Styles ──
const pageStyle: CSSProperties = { minHeight: "100dvh", background: "#F8FAFC" };
const innerStyle: CSSProperties = { maxWidth: 480, margin: "0 auto", padding: "24px 18px 120px", display: "grid", gap: 20 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#0F172A" };

const modeRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const modeBtnStyle: CSSProperties = { padding: "8px 16px", borderRadius: 999, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" };

const customRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 18, background: "#fff", border: "1px solid #E2E8F0" };
const customInputStyle: CSSProperties = { width: 72, border: "none", outline: "none", fontSize: 24, fontWeight: 900, color: "#0F172A", fontFamily: "inherit", background: "transparent" };

const timerCardStyle: CSSProperties = { background: "#fff", borderRadius: 28, border: "1px solid #E2E8F0", padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 };
const ringWrapStyle: CSSProperties = { position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" };
const timerDisplayStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" };

const pomRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const pomDotStyle: CSSProperties = { width: 12, height: 12, borderRadius: 999 };

const controlRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 20 };
const mainBtnStyle: CSSProperties = { width: 72, height: 72, borderRadius: 999, border: "none", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" };
const subBtnStyle: CSSProperties = { width: 52, height: 52, borderRadius: 999, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center", color: "#64748B" };

const guideCardStyle: CSSProperties = { borderRadius: 20, padding: "18px", background: "#FFFBEB", border: "1px solid #FDE68A" };
const guideTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#92400E", marginBottom: 6 };
const guideBodyStyle: CSSProperties = { fontSize: 13, lineHeight: 1.75, color: "#78350F" };
