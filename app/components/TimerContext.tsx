"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type TimerState = "idle" | "running" | "paused";

type TimerContextValue = {
  state: TimerState;
  elapsedMs: number;
  startedAt: string | null;
  showSaveModal: boolean;
  finalMs: number;
  finalStartedAt: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dismissModal: () => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [finalMs, setFinalMs] = useState(0);
  const [finalStartedAt, setFinalStartedAt] = useState<string | null>(null);
  const accRef = useRef(0);
  const tickRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (state !== "running") { cancelAnimationFrame(tickRef.current); return; }
    const tick = () => {
      setElapsedMs(accRef.current + (Date.now() - startRef.current));
      tickRef.current = requestAnimationFrame(tick);
    };
    tickRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(tickRef.current);
  }, [state]);

  const start = useCallback(() => {
    accRef.current = 0;
    startRef.current = Date.now();
    setElapsedMs(0);
    setStartedAt(new Date().toISOString());
    setState("running");
  }, []);

  const pause = useCallback(() => {
    accRef.current += Date.now() - startRef.current;
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    startRef.current = Date.now();
    setState("running");
  }, []);

  const stop = useCallback(() => {
    const final = state === "running" ? accRef.current + (Date.now() - startRef.current) : accRef.current;
    cancelAnimationFrame(tickRef.current);
    setFinalMs(final);
    setFinalStartedAt(startedAt);
    setElapsedMs(final);
    setState("idle");
    setShowSaveModal(true);
  }, [state, startedAt]);

  const dismissModal = useCallback(() => {
    setShowSaveModal(false);
    setFinalMs(0);
    setFinalStartedAt(null);
  }, []);

  return (
    <TimerContext.Provider value={{ state, elapsedMs, startedAt, showSaveModal, finalMs, finalStartedAt, start, pause, resume, stop, dismissModal }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
