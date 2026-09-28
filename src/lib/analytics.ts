import { addDays } from "date-fns";
import { daysBetween, fromISO, generatePlan, toISO } from "./scheduler";
import type { CompletedSession, ISODate, Plan, PlannerInput } from "./types";

// ================= Momentum & burnout =================

export type MomentumAction =
  | { type: "reduce_weekdays"; by: number }
  | { type: "half_day"; date: ISODate; hours: number }
  | { type: "block_day"; date: ISODate }
  | { type: "none" };

export interface Momentum {
  hasHistory: boolean;
  days: { date: ISODate; planned: number; done: number }[];
  completionRate: number | null;
  streak: number;
  trend: "up" | "flat" | "down" | null;
  heavyDays: { date: ISODate; minutes: number }[];
  avgNext7: number;
  avgDonePast7: number;
  risk: "low" | "medium" | "high";
  reasons: string[];
  suggestions: { label: string; detail: string; action: MomentumAction }[];
}

const shift = (d: ISODate, n: number) => toISO(addDays(fromISO(d), n));

export function momentum(input: PlannerInput, plan: Plan, completed: CompletedSession[], plannedLog: Record<ISODate, number>, today: ISODate): Momentum {
  const doneOn = (d: ISODate) => completed.filter((c) => c.date === d).reduce((a, c) => a + c.minutes, 0);
  const days = Array.from({ length: 7 }, (_, i) => shift(today, i - 7)).map((date) => ({
    date,
    planned: Math.max(plannedLog[date] ?? 0, doneOn(date)),
    done: doneOn(date),
  }));
  const withPlan = days.filter((d) => d.planned > 0);
  const hasHistory = withPlan.length >= 2;
  const completionRate = hasHistory ? withPlan.reduce((a, d) => a + d.done, 0) / withPlan.reduce((a, d) => a + d.planned, 0) : null;

  let streak = doneOn(today) > 0 ? 1 : 0;
  for (let i = 1; i <= 60 && doneOn(shift(today, -i)) > 0; i++) streak++;

  const recent = days.slice(-3).reduce((a, d) => a + d.done, 0) / 3;
  const earlier = days.slice(0, 4).reduce((a, d) => a + d.done, 0) / 4;
  const trend = !hasHistory ? null : recent > earlier * 1.15 ? "up" : recent < earlier * 0.85 ? "down" : "flat";

  const next7 = Array.from({ length: 7 }, (_, i) => shift(today, i)).map((date) => ({
    date,
    minutes: plan.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0),
  }));
  const heavyDays = next7.filter((d) => d.minutes >= 300);
  const avgNext7 = next7.reduce((a, d) => a + d.minutes, 0) / 7;
  const avgDonePast7 = days.reduce((a, d) => a + d.done, 0) / 7;

  let points = 0;
  const reasons: string[] = [];
  const flag = (pts: number, reason: string) => {
    points += pts;
    reasons.push(reason);
  };
  if (completionRate != null && completionRate < 0.5) flag(2, `You finished only ${Math.round(completionRate * 100)}% of planned sessions this week.`);
  else if (completionRate != null && completionRate < 0.7) flag(1, `You finished ${Math.round(completionRate * 100)}% of planned sessions this week.`);
  if (heavyDays.length >= 3) flag(2, `${heavyDays.length} days of 5h+ study in the next week.`);
  else if (heavyDays.length) flag(1, `${heavyDays.length} day(s) of 5h+ study coming up.`);
  if (hasHistory && avgNext7 > avgDonePast7 * 1.5 && avgNext7 - avgDonePast7 > 45)
    flag(1, `The coming week asks ${Math.round(avgNext7)} min/day; you've been doing ${Math.round(avgDonePast7)}.`);
  if (trend === "down") flag(1, "Your study time dropped over the last three days.");
  if (!next7.some((d) => d.minutes === 0)) flag(0, "No rest day in the next 7 days.");
  const risk = points >= 4 ? "high" : points >= 2 ? "medium" : "low";

  const suggestions: Momentum["suggestions"] = [];
  if (completionRate != null && completionRate < 0.7)
    suggestions.push({
      label: "Right-size your weekdays",
      detail: "Your plan is more ambitious than your real pace. Cutting 30 min per weekday makes it something you'll actually finish.",
      action: { type: "reduce_weekdays", by: 0.5 },
    });
  const heaviest = [...next7].sort((a, b) => b.minutes - a.minutes)[0];
  if (heaviest && heaviest.minutes >= 240)
    suggestions.push({
      label: `Lighten ${fromISO(heaviest.date).toLocaleDateString("en-US", { weekday: "long" })}`,
      detail: `It has ${Math.round(heaviest.minutes / 60)}h planned. Halving it spreads the load across other days.`,
      action: { type: "half_day", date: heaviest.date, hours: Math.round(heaviest.minutes / 60 / 2 / 0.5) * 0.5 },
    });
  const examDays = new Set(input.exams.map((e) => e.date));
  const lightest = next7
    .slice(1)
    .filter((d) => d.minutes > 0 && !examDays.has(shift(d.date, 1)))
    .sort((a, b) => a.minutes - b.minutes)[0];
  if (!next7.some((d) => d.minutes === 0) && lightest)
    suggestions.push({
      label: `Take ${fromISO(lightest.date).toLocaleDateString("en-US", { weekday: "long" })} off`,
      detail: "Rest is part of the plan. This is your lightest day, and it isn't the day before an exam.",
      action: { type: "block_day", date: lightest.date },
    });
  if (trend === "down")
    suggestions.push({
      label: "Start with a quick win",
      detail: "Open tomorrow with a short review of your strongest subject. Early success rebuilds momentum.",
      action: { type: "none" },
    });
  if (streak >= 3)
    suggestions.push({
      label: `Protect your ${streak}-day streak`,
      detail: "Even one 25-minute session today keeps it alive.",
      action: { type: "none" },
    });

  return { hasHistory, days, completionRate, streak, trend, heavyDays, avgNext7, avgDonePast7, risk, reasons, suggestions };
}

// ================= Readiness forecast (Monte Carlo) =================

export interface ForecastRow {
  subjectId: string;
  name: string;
  color: string;
  exam: ISODate;
  sessions: number;
  expected: number;
  p10: number;
  p90: number;
  pReady: number;
  pReadyPlus: number;
  pReadyMinus: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const READY = 0.8;
const RUNS = 1000;

function simulate(plan: Plan, subjectId: string, examDate: ISODate, rate: number, seed: number) {
  const stat = plan.stats.find((s) => s.subjectId === subjectId);
  if (!stat || !stat.targetMinutes) return { samples: [1], sessions: 0 };
  const sessions = plan.sessions.filter((s) => s.subjectId === subjectId && s.date < examDate);
  const rng = mulberry32(seed);
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    // each simulated fortnight has its own "form": some weeks you're sharper, some you slip
    const gauss = Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
    const p = Math.min(0.98, Math.max(0.2, rate + 0.12 * gauss));
    let got = stat.completedMinutes;
    for (const s of sessions) if (rng() < p) got += s.minutes;
    samples.push(Math.min(1.2, got / stat.targetMinutes));
  }
  samples.sort((a, b) => a - b);
  return { samples, sessions: sessions.length };
}

const quantile = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];
const pAbove = (xs: number[], t: number) => xs.filter((x) => x >= t).length / xs.length;

export function forecast(input: PlannerInput, plan: Plan, completed: CompletedSession[], today: ISODate, rate: number): ForecastRow[] {
  const variant = (delta: number): PlannerInput => ({
    ...input,
    prefs: { ...input.prefs, weekly: input.prefs.weekly.map((d) => ({ ...d, hours: Math.max(0, d.hours + delta) })) },
  });
  const plus = generatePlan(variant(1), completed, today);
  const minus = generatePlan(variant(-1), completed, today);

  return input.exams
    .filter((e) => daysBetween(today, e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e, i) => {
      const s = input.subjects.find((x) => x.id === e.subjectId);
      if (!s) return null;
      const base = simulate(plan, s.id, e.date, rate, 42 + i);
      return {
        subjectId: s.id,
        name: s.name,
        color: s.color,
        exam: e.date,
        sessions: base.sessions,
        expected: base.samples.reduce((a, x) => a + x, 0) / base.samples.length,
        p10: quantile(base.samples, 0.1),
        p90: quantile(base.samples, 0.9),
        pReady: pAbove(base.samples, READY),
        pReadyPlus: pAbove(simulate(plus, s.id, e.date, rate, 42 + i).samples, READY),
        pReadyMinus: pAbove(simulate(minus, s.id, e.date, rate, 42 + i).samples, READY),
      };
    })
    .filter((x): x is ForecastRow => !!x);
}

// ================= Study buddy (no server: profiles travel as a code) =================

export interface BuddyProfile {
  v: 1;
  name: string;
  subjects: { n: string; c: number; t: string[] }[];
  week: { h: number; s: string }[];
}

export function toBuddyProfile(input: PlannerInput): BuddyProfile {
  return {
    v: 1,
    name: input.studentName || "A classmate",
    subjects: input.subjects.map((s) => ({ n: s.name, c: s.confidence, t: s.topics.slice(0, 5) })),
    week: input.prefs.weekly.map((d) => ({ h: d.hours, s: d.start })),
  };
}

export function encodeBuddy(p: BuddyProfile): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(p))));
  return `SS1-${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export function decodeBuddy(code: string): BuddyProfile | null {
  try {
    const raw = code.trim().replace(/^SS1-/, "").replace(/-/g, "+").replace(/_/g, "/");
    const p = JSON.parse(decodeURIComponent(escape(atob(raw)))) as BuddyProfile;
    return p.v === 1 && Array.isArray(p.subjects) && Array.isArray(p.week) ? p : null;
  } catch {
    return null;
  }
}

export interface BuddyMatch {
  score: number;
  pairs: { subject: string; mine: number; theirs: number; mode: "you_teach" | "they_teach" | "together" | "both_strong"; topics: string[] }[];
  slots: { day: string; from: string; to: string; minutes: number }[];
}

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function matchBuddy(me: BuddyProfile, them: BuddyProfile): BuddyMatch {
  const pairs: BuddyMatch["pairs"] = [];
  for (const a of me.subjects) {
    const b = them.subjects.find((x) => x.n.trim().toLowerCase() === a.n.trim().toLowerCase());
    if (!b) continue;
    const diff = a.c - b.c;
    const mode = diff >= 2 ? "you_teach" : diff <= -2 ? "they_teach" : a.c <= 3 && b.c <= 3 ? "together" : "both_strong";
    pairs.push({ subject: a.n, mine: a.c, theirs: b.c, mode, topics: [...new Set([...a.t, ...b.t])].slice(0, 4) });
  }
  pairs.sort((x, y) => Math.abs(y.mine - y.theirs) - Math.abs(x.mine - x.theirs));

  const slots = me.week
    .map((m, i) => {
      const t = them.week[i];
      if (!t) return null;
      const from = Math.max(toMin(m.s), toMin(t.s));
      const to = Math.min(toMin(m.s) + m.h * 60, toMin(t.s) + t.h * 60);
      return to - from >= 45 ? { day: DAY[i], from: toHHMM(from), to: toHHMM(to), minutes: to - from } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  const complement = pairs.filter((p) => p.mode === "you_teach" || p.mode === "they_teach").length;
  const score = Math.min(100, Math.round(complement * 25 + pairs.length * 8 + (slots.length ? 20 : 0)));
  return { score, pairs, slots };
}

/** A clearly-labelled sample classmate with mirrored strengths, for trying the feature solo. */
export function sampleBuddy(me: BuddyProfile): BuddyProfile {
  return {
    v: 1,
    name: "Kabir (sample classmate)",
    subjects: me.subjects.map((s) => ({ ...s, c: Math.min(5, Math.max(1, 6 - s.c)) })),
    week: me.week.map((d, i) => ({ h: d.h, s: i === 0 || i === 6 ? "11:00" : "18:00" })),
  };
}
