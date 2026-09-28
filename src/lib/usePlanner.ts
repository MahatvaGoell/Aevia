"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdjustResult, FutureSelfResult, InsightsResult, ParseResult, StudyKitResult, TeachBackResult } from "./ai";
import type { MomentumAction } from "./analytics";
import { demoHistory, demoInput, EMPTY_INPUT } from "./demo";
import { applyOps, mergeParsed } from "./ops";
import { daysBetween, generatePlan, toISO } from "./scheduler";
import type { CompletedSession, DayEnergy, ISODate, Plan, PlannerInput, Session, Subject } from "./types";
import { comparePlans, type WhatIfDiff } from "./whatif";

export interface WhatIf {
  scenario: string;
  input: PlannerInput;
  plan: Plan;
  diff: WhatIfDiff;
  aiReply?: string;
}

export const WHAT_IF_PRESETS = [
  { id: "skip-today", label: "Skip today" },
  { id: "skip-tomorrow", label: "Take tomorrow off" },
  { id: "one-hour", label: "Only 1 hour today" },
  { id: "weekend-off", label: "Take this weekend off" },
] as const;
export type WhatIfPreset = (typeof WHAT_IF_PRESETS)[number]["id"];

const STORAGE_KEY = "ai-study-planner:v1";

export interface Stored {
  signedIn?: boolean; // showcase sign-in only, no real auth
  input: PlannerInput;
  completed: CompletedSession[];
  plannedLog?: Record<ISODate, number>; // minutes planned per past day, for momentum
}

/** Write a whole session synchronously (used by the landing page right before it opens the app). */
export function saveSession(s: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function readSession(): Stored | null {
  return load();
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export async function callAI<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function usePlanner() {
  const [today, setToday] = useState(() => toISO(new Date()));
  const [input, setInput] = useState<PlannerInput>(EMPTY_INPUT);
  const [completed, setCompleted] = useState<CompletedSession[]>([]);
  const [plannedLog, setPlannedLog] = useState<Record<ISODate, number>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // insights are tied to the exact input they explain, so any edit makes them stale
  const [insightsFor, setInsightsFor] = useState<{ input: PlannerInput; data: InsightsResult } | null>(null);
  const insights = insightsFor?.input === input ? insightsFor.data : null;

  useEffect(() => {
    const s = load();
    if (s) {
      // one-time hydration from localStorage (an external store) after mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(s.input);
      setCompleted(s.completed);
      setPlannedLog(s.plannedLog ?? {});
      setSignedIn(!!s.signedIn);
    }
    setHydrated(true);
    // roll over at midnight
    const t = setInterval(() => setToday(toISO(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ signedIn, input, completed, plannedLog } satisfies Stored));
    } catch {}
  }, [signedIn, input, completed, plannedLog, hydrated]);

  const plan = useMemo(() => generatePlan(input, completed, today), [input, completed, today]);
  const hasData = input.subjects.length > 0;

  // remember how much was planned for today (planned + already done), so past days can be scored later
  const todayLoad =
    plan.sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0) +
    completed.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0);
  if (hydrated && hasData && todayLoad > (plannedLog[today] ?? 0)) setPlannedLog((prev) => ({ ...prev, [today]: todayLoad }));

  const toggleDone = useCallback((s: Session) => {
    setCompleted((prev) =>
      prev.some((c) => c.id === s.id)
        ? prev.filter((c) => c.id !== s.id)
        : // completed sessions get their own id: the engine re-numbers today's remaining slots after a replan
          [...prev, { ...s, id: `done:${s.id}:${Date.now()}`, completedAt: new Date().toISOString() }],
    );
  }, []);

  const loadDemo = useCallback(() => {
    const t = toISO(new Date());
    const demo = demoInput(t);
    const history = demoHistory(t, demo);
    setInput(demo);
    setCompleted(history.completed);
    setPlannedLog(history.plannedLog);
  }, []);

  const reset = useCallback(() => {
    setInput(EMPTY_INPUT);
    setCompleted([]);
    setPlannedLog({});
    setSignedIn(false);
  }, []);

  /** Onboarding answers become the planner input; history starts fresh. */
  const startWith = useCallback((next: PlannerInput) => {
    setInput(next);
    setCompleted([]);
    setPlannedLog({});
  }, []);

  const signIn = useCallback(() => setSignedIn(true), []);
  const signOut = useCallback(() => setSignedIn(false), []);

  /** Put these topics first (in this order), keep the rest after. */
  const setTopicOrder = useCallback((subjectId: string, order: string[]) => {
    setInput((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => {
        if (s.id !== subjectId) return s;
        const seen = new Set<string>();
        const merged = [...order, ...s.topics].filter((t) => {
          const k = t.trim().toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return { ...s, topics: merged };
      }),
    }));
  }, []);

  /** Blend an AI-assessed confidence into the subject's confidence; returns before/after. */
  const blendConfidence = useCallback(
    (subjectId: string, suggested: number) => {
      const s = input.subjects.find((x) => x.id === subjectId);
      if (!s) return null;
      const after = Math.min(5, Math.max(1, Math.round((s.confidence + suggested) / 2))) as Subject["confidence"];
      setInput((prev) => ({ ...prev, subjects: prev.subjects.map((x) => (x.id === subjectId ? { ...x, confidence: after } : x)) }));
      return { before: s.confidence, after };
    },
    [input.subjects],
  );

  const applyMomentumAction = useCallback((a: MomentumAction) => {
    setInput((prev) => {
      if (a.type === "reduce_weekdays")
        return {
          ...prev,
          prefs: { ...prev.prefs, weekly: prev.prefs.weekly.map((d, i) => (i === 0 || i === 6 ? d : { ...d, hours: Math.max(0.5, d.hours - a.by) })) },
        };
      if (a.type === "half_day") return { ...prev, dayOverrides: { ...prev.dayOverrides, [a.date]: a.hours } };
      if (a.type === "block_day")
        return prev.blocked.some((b) => b.date === a.date) ? prev : { ...prev, blocked: [...prev.blocked, { date: a.date, reason: "Rest day" }] };
      return prev;
    });
  }, []);

  const setDayEnergy = useCallback(
    (level: DayEnergy) => setInput((prev) => ({ ...prev, dayEnergy: { ...prev.dayEnergy, [today]: level } })),
    [today],
  );

  const parseText = useCallback(
    async (text: string) => {
      const parsed = await callAI<ParseResult>("/api/parse", { text, today });
      setInput((prev) => mergeParsed(prev, parsed));
      return parsed;
    },
    [today],
  );

  const requestOps = useCallback(
    async (request: string) => {
      const context = {
        subjects: input.subjects.map(({ name, priority, difficulty, confidence }) => ({ name, priority, difficulty, confidence })),
        exams: input.exams.map((e) => ({ subject: input.subjects.find((s) => s.id === e.subjectId)?.name, date: e.date, title: e.title })),
        assignments: input.assignments.map((a) => ({ title: a.title, due: a.dueDate, hours: a.estimatedHours })),
        weeklyHours: input.prefs.weekly.map((d) => d.hours),
        blocked: input.blocked,
        dayOverrides: input.dayOverrides,
      };
      return callAI<AdjustResult>("/api/adjust", { request, today, context });
    },
    [input, today],
  );

  const adjust = useCallback(
    async (request: string) => {
      const res = await requestOps(request);
      const { input: next, log } = applyOps(input, res.operations);
      setInput(next);
      return { reply: res.reply, log };
    },
    [input, requestOps],
  );

  /** "I have N hours free today" — rebuilds today around the given time. */
  const planMyDay = useCallback(
    (hours: number, start?: string) => {
      setInput((prev) => ({
        ...prev,
        blocked: prev.blocked.filter((b) => b.date !== today),
        dayOverrides: { ...prev.dayOverrides, [today]: Math.max(0, hours) },
        dayStartOverrides: start ? { ...prev.dayStartOverrides, [today]: start } : prev.dayStartOverrides,
      }));
    },
    [today],
  );

  // ---- Butterfly Effect: simulate a change on a copy, show the future cost, commit only if accepted ----
  const buildWhatIf = useCallback(
    (scenario: string, next: PlannerInput, aiReply?: string): WhatIf => {
      const after = generatePlan(next, completed, today);
      return { scenario, input: next, plan: after, diff: comparePlans(input, plan, after), aiReply };
    },
    [completed, input, plan, today],
  );

  const simulatePreset = useCallback(
    (preset: WhatIfPreset): WhatIf => {
      const next: PlannerInput = structuredClone(input);
      const day = (n: number) => toISO(new Date(new Date(`${today}T12:00:00`).getTime() + n * 86_400_000));
      const block = (d: string) => {
        if (!next.blocked.some((b) => b.date === d)) next.blocked.push({ date: d, reason: "Day off (what-if)" });
      };
      let label: string = WHAT_IF_PRESETS.find((p) => p.id === preset)!.label;
      if (preset === "skip-today") block(today);
      if (preset === "skip-tomorrow") block(day(1));
      if (preset === "one-hour") next.dayOverrides[today] = 1;
      if (preset === "weekend-off") {
        const dow = new Date(`${today}T12:00:00`).getDay();
        const toSat = (6 - dow + 7) % 7;
        const sat = day(toSat);
        const sun = day(toSat === 6 ? 0 : toSat + 1); // today is Sunday -> just today
        block(sat);
        block(sun);
        label = `Take the weekend off (${sat} & ${sun})`;
      }
      return buildWhatIf(label, next);
    },
    [buildWhatIf, input, today],
  );

  const simulateText = useCallback(
    async (scenario: string): Promise<WhatIf> => {
      const res = await requestOps(scenario);
      const { input: next } = applyOps(input, res.operations);
      return buildWhatIf(scenario, next, res.reply);
    },
    [buildWhatIf, input, requestOps],
  );

  const commitWhatIf = useCallback((w: WhatIf) => setInput(w.input), []);

  /** Teach It Back: the explanation's score feeds back into the subject's confidence, which reshapes the plan. */
  const teachBack = useCallback(
    async (subjectId: string, topic: string, explanation: string) => {
      const subject = input.subjects.find((s) => s.id === subjectId);
      if (!subject) throw new Error("Pick a subject first");
      const res = await callAI<TeachBackResult>("/api/teach-back", { subject: subject.name, topic, explanation });
      const newConfidence = Math.min(5, Math.max(1, Math.round((subject.confidence + res.suggestedConfidence) / 2))) as Subject["confidence"];
      const weakTopic = res.score < 70 && topic.trim() ? topic.trim() : null;
      setInput((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id !== subjectId
            ? s
            : {
                ...s,
                confidence: newConfidence,
                // a shaky topic moves to the front so the next Learn/Practice sessions target it
                topics: weakTopic ? [weakTopic, ...s.topics.filter((t) => t.toLowerCase() !== weakTopic.toLowerCase())] : s.topics,
              },
        ),
      }));
      return { ...res, confidenceBefore: subject.confidence, confidenceAfter: newConfidence };
    },
    [input.subjects],
  );

  const studyKit = useCallback(
    (session: Session) => {
      const subject = input.subjects.find((s) => s.id === session.subjectId);
      return callAI<StudyKitResult>("/api/study-kit", {
        subject: subject?.name ?? "",
        topic: session.title,
        kind: session.kind,
        minutes: session.minutes,
        confidence: subject?.confidence ?? 3,
      });
    },
    [input.subjects],
  );

  const askFutureSelf = useCallback(
    async (w: WhatIf) => {
      const impact = {
        overallReadiness: { before: Math.round(w.diff.overall.before * 100), after: Math.round(w.diff.overall.after * 100) },
        studyTimeLostMinutes: w.diff.lostMinutes,
        subjects: w.diff.subjects.map((s) => ({
          subject: s.name,
          readinessBefore: Math.round(s.before * 100),
          readinessAfter: Math.round(s.after * 100),
          exam: input.exams.find((e) => e.subjectId === s.subjectId)?.date ?? null,
        })),
        heavierDays: w.diff.heavierDays,
        cramDays: w.diff.cramDays,
        recovery: w.diff.recovery,
        newWarnings: w.diff.newWarnings,
      };
      return callAI<FutureSelfResult>("/api/future-self", { scenario: w.scenario, today, impact });
    },
    [input.exams, today],
  );

  const explain = useCallback(async () => {
    const name = (id: string) => input.subjects.find((s) => s.id === id)?.name ?? id;
    const summary = {
      student: input.studentName,
      subjects: input.subjects.map((s) => ({ name: s.name, priority: s.priority, difficulty: s.difficulty, confidence: s.confidence })),
      exams: input.exams.map((e) => ({ subject: name(e.subjectId), date: e.date, daysLeft: daysBetween(today, e.date) })),
      assignments: input.assignments.map((a) => ({ title: a.title, subject: name(a.subjectId), due: a.dueDate })),
      hoursPerSubject: plan.stats.map((s) => ({
        subject: name(s.subjectId),
        recommendedH: +(s.targetMinutes / 60).toFixed(1),
        plannedH: +(s.plannedMinutes / 60).toFixed(1),
        doneH: +(s.completedMinutes / 60).toFixed(1),
      })),
      today: plan.sessions.filter((s) => s.date === today).map((s) => `${s.start} ${name(s.subjectId)}: ${s.title}`),
      next7Days: Object.entries(
        plan.sessions
          .filter((s) => daysBetween(today, s.date) < 7)
          .reduce<Record<string, string[]>>((m, s) => ((m[s.date] ??= []).push(name(s.subjectId)), m), {}),
      ),
      warnings: plan.warnings.map((w) => w.message),
      blockedDays: input.blocked,
    };
    const res = await callAI<InsightsResult>("/api/insights", { today, summary });
    setInsightsFor({ input, data: res });
    return res;
  }, [input, plan, today]);

  return {
    hydrated,
    today,
    input,
    setInput,
    completed,
    plan,
    hasData,
    insights,
    toggleDone,
    loadDemo,
    reset,
    parseText,
    adjust,
    explain,
    planMyDay,
    simulatePreset,
    simulateText,
    commitWhatIf,
    askFutureSelf,
    teachBack,
    studyKit,
    plannedLog,
    signedIn,
    signIn,
    signOut,
    startWith,
    setTopicOrder,
    blendConfidence,
    applyMomentumAction,
    setDayEnergy,
  };
}

export type Planner = ReturnType<typeof usePlanner>;
