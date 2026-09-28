import { daysBetween } from "./scheduler";
import type { ISODate, Plan, PlannerInput, SubjectStat } from "./types";

/** Share of recommended prep that will be done by the exam (completed + still planned). */
export function readiness(s: SubjectStat): number {
  if (!s.targetMinutes) return 1;
  return Math.min(1, (s.plannedMinutes + s.completedMinutes) / s.targetMinutes);
}

export interface WhatIfDiff {
  subjects: { subjectId: string; name: string; color: string; before: number; after: number; lostMinutes: number }[];
  overall: { before: number; after: number };
  lostMinutes: number;
  heavierDays: { date: ISODate; beforeMin: number; afterMin: number }[];
  cramDays: { before: number; after: number }; // days with 5h+ of study
  newWarnings: string[];
  recovery: { days: number; minutesPerDay: number } | null;
}

const minutesByDay = (plan: Plan) =>
  plan.sessions.reduce<Record<string, number>>((m, s) => ((m[s.date] = (m[s.date] ?? 0) + s.minutes), m), {});

export function comparePlans(input: PlannerInput, before: Plan, after: Plan): WhatIfDiff {
  const subjects = input.subjects
    .map((s) => {
      const b = before.stats.find((x) => x.subjectId === s.id);
      const a = after.stats.find((x) => x.subjectId === s.id);
      if (!b || !a) return null;
      return {
        subjectId: s.id,
        name: s.name,
        color: s.color,
        before: readiness(b),
        after: readiness(a),
        lostMinutes: b.plannedMinutes - a.plannedMinutes,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((x, y) => y.before - y.after - (x.before - x.after));

  const weighted = (plan: Plan) => {
    const t = plan.stats.reduce((a, s) => a + s.targetMinutes, 0);
    return t ? plan.stats.reduce((a, s) => a + readiness(s) * s.targetMinutes, 0) / t : 1;
  };

  const bDays = minutesByDay(before);
  const aDays = minutesByDay(after);
  const heavierDays = Object.keys({ ...bDays, ...aDays })
    .map((date) => ({ date, beforeMin: bDays[date] ?? 0, afterMin: aDays[date] ?? 0 }))
    .filter((d) => d.afterMin - d.beforeMin >= 30)
    .sort((x, y) => y.afterMin - y.beforeMin - (x.afterMin - x.beforeMin))
    .slice(0, 4);
  const cram = (m: Record<string, number>) => Object.values(m).filter((v) => v >= 300).length;

  const lostMinutes =
    before.sessions.reduce((a, s) => a + s.minutes, 0) - after.sessions.reduce((a, s) => a + s.minutes, 0);

  // how much extra per day, over the days before the next exam, would win the lost time back
  const nextExam = input.exams.map((e) => e.date).filter((d) => daysBetween(before.today, d) > 1).sort()[0];
  const window = nextExam ? Math.max(1, Math.min(7, daysBetween(before.today, nextExam) - 1)) : 5;
  const recovery = lostMinutes > 0 ? { days: window, minutesPerDay: Math.ceil(lostMinutes / window / 5) * 5 } : null;

  const beforeMsgs = new Set(before.warnings.map((w) => w.message));
  return {
    subjects,
    overall: { before: weighted(before), after: weighted(after) },
    lostMinutes,
    heavierDays,
    cramDays: { before: cram(bDays), after: cram(aDays) },
    newWarnings: after.warnings.filter((w) => !beforeMsgs.has(w.message)).map((w) => w.message),
    recovery,
  };
}
