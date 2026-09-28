import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  CompletedSession,
  ISODate,
  Plan,
  PlannerInput,
  PlanWarning,
  Session,
  SessionKind,
  Subject,
  SubjectStat,
} from "./types";

/**
 * Deterministic study-schedule engine.
 *
 * 1. Every exam / assignment / ongoing subject becomes a "work item" with a
 *    target amount of study time and a deadline.
 * 2. The day before each exam gets a reserved revision block.
 * 3. Remaining slots are filled greedily by "least slack first": the item whose
 *    remaining work is largest relative to the time left before its deadline
 *    wins, weighted by priority/difficulty/confidence, with a variety penalty
 *    so a day isn't five hours of the same subject.
 *
 * The AI layer never writes the timetable directly — it only edits the inputs,
 * so every plan it produces is valid by construction.
 */

const MAX_HORIZON_DAYS = 90;
const MIN_HORIZON_DAYS = 14;
const MUST_DO_PRESSURE = 1;
const LOAD_CEILING = 0.9;
const MIN_PARTIAL_SESSION = 25; // leftover minutes worth a shorter session // keep ~10% of slots free as buffer when the plan is tight

export const toISO = (d: Date): ISODate => format(d, "yyyy-MM-dd");
export const fromISO = (s: ISODate): Date => parseISO(s);
export const daysBetween = (a: ISODate, b: ISODate) =>
  differenceInCalendarDays(fromISO(b), fromISO(a));

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Hours a subject needs before its exam: ~6h (easy, confident, low priority) up to ~20h. */
export function estimateExamHours(s: Subject): number {
  return 3 + 1.5 * s.difficulty + 1.2 * (5 - s.confidence) + 1 * s.priority;
}

interface WorkItem {
  key: string;
  subjectId: string;
  kind: "exam" | "assignment" | "ongoing";
  examId?: string;
  assignmentId?: string;
  label: string;
  deadlineIdx: number; // last day index work may be scheduled on
  blockedIdx?: number; // exam day: don't study this subject that day
  remainingSlots: number;
  targetSlots: number;
  cutSlots: number; // trimmed to fit available time
  weight: number;
}

export function generatePlan(
  input: PlannerInput,
  completed: CompletedSession[],
  today: ISODate,
): Plan {
  const { prefs, subjects } = input;
  const slotLen = prefs.sessionMinutes + prefs.breakMinutes;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const warnings: PlanWarning[] = [];

  const upcomingExams = input.exams
    .filter((e) => subjectById.has(e.subjectId) && daysBetween(today, e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const openAssignments = input.assignments.filter(
    (a) => subjectById.has(a.subjectId) && daysBetween(today, a.dueDate) >= 0,
  );

  // ---- horizon ----
  const lastDeadline = [...upcomingExams.map((e) => e.date), ...openAssignments.map((a) => a.dueDate)]
    .map((d) => daysBetween(today, d))
    .reduce((m, d) => Math.max(m, d), MIN_HORIZON_DAYS - 1);
  const horizon = Math.min(lastDeadline, MAX_HORIZON_DAYS - 1) + 1;
  const dates: ISODate[] = Array.from({ length: horizon }, (_, i) => toISO(addDays(fromISO(today), i)));
  const idxOf = (d: ISODate) => daysBetween(today, d);

  // ---- capacity per day ----
  const blocked = new Set(input.blocked.map((b) => b.date));
  const examDays = new Set(upcomingExams.map((e) => e.date));
  const completedToday = completed.filter((c) => c.date === today);
  const minutesDoneToday = completedToday.reduce((s, c) => s + c.minutes, 0);

  const dayStart: string[] = [];
  const partialMinutes: number[] = []; // length of a shorter final session, 0 if none
  const daySlots: number[] = dates.map((date, i) => {
    const avail = prefs.weekly[fromISO(date).getDay()];
    dayStart[i] = input.dayStartOverrides?.[date] ?? avail.start;
    partialMinutes[i] = 0;
    if (blocked.has(date)) return 0;
    let minutes = (input.dayOverrides[date] ?? avail.hours) * 60;
    if (examDays.has(date)) minutes = Math.floor(minutes / 2); // lighter load on exam days
    if (i === 0) minutes -= minutesDoneToday;
    if (minutes <= 0) return 0;
    const full = Math.floor((minutes + prefs.breakMinutes) / slotLen);
    const leftover = minutes - full * slotLen;
    if (leftover >= MIN_PARTIAL_SESSION) {
      partialMinutes[i] = Math.min(leftover, prefs.sessionMinutes);
      return full + 1;
    }
    return full;
  });
  // today's remaining sessions start after the ones already completed
  const startOffsetSlots = dates.map((_, i) => (i === 0 ? completedToday.length : 0));
  const totalCapacityMinutes = daySlots.reduce(
    (s, n, i) => s + (partialMinutes[i] ? (n - 1) * prefs.sessionMinutes + partialMinutes[i] : n * prefs.sessionMinutes),
    0,
  );

  // ---- credit already-completed work ----
  const doneBySubject = new Map<string, number>();
  const doneByAssignment = new Map<string, number>();
  for (const c of completed) {
    if (c.assignmentId) doneByAssignment.set(c.assignmentId, (doneByAssignment.get(c.assignmentId) ?? 0) + c.minutes);
    else doneBySubject.set(c.subjectId, (doneBySubject.get(c.subjectId) ?? 0) + c.minutes);
  }
  const creditUsed = new Map<string, number>();
  const takeCredit = (subjectId: string, wanted: number) => {
    const avail = (doneBySubject.get(subjectId) ?? 0) - (creditUsed.get(subjectId) ?? 0);
    const used = Math.max(0, Math.min(avail, wanted));
    creditUsed.set(subjectId, (creditUsed.get(subjectId) ?? 0) + used);
    return used;
  };

  // ---- build work items ----
  const items: WorkItem[] = [];
  const slotsFor = (minutes: number) => Math.max(0, Math.ceil(minutes / prefs.sessionMinutes));

  for (const exam of upcomingExams) {
    const s = subjectById.get(exam.subjectId)!;
    const targetMin = estimateExamHours(s) * 60;
    const credit = takeCredit(s.id, targetMin);
    const examIdx = idxOf(exam.date);
    items.push({
      key: `exam:${exam.id}`,
      subjectId: s.id,
      kind: "exam",
      examId: exam.id,
      label: exam.title || `${s.name} exam`,
      deadlineIdx: Math.min(examIdx - 1, horizon - 1),
      blockedIdx: examIdx,
      targetSlots: slotsFor(targetMin),
      remainingSlots: slotsFor(targetMin - credit),
      cutSlots: 0,
      weight: 0.6 + 0.2 * s.priority + 0.12 * s.difficulty + 0.1 * (5 - s.confidence),
    });
  }

  for (const a of openAssignments) {
    const s = subjectById.get(a.subjectId)!;
    const targetMin = a.estimatedHours * 60;
    const dueIdx = idxOf(a.dueDate);
    items.push({
      key: `asg:${a.id}`,
      subjectId: s.id,
      kind: "assignment",
      assignmentId: a.id,
      label: a.title,
      deadlineIdx: Math.min(Math.max(0, dueIdx - 1), horizon - 1), // finish a day early
      targetSlots: slotsFor(targetMin),
      remainingSlots: slotsFor(targetMin - (doneByAssignment.get(a.id) ?? 0)),
      cutSlots: 0,
      weight: 1.1 + 0.1 * s.priority,
    });
  }

  // subjects with no exam in range still get light weekly upkeep
  const examSubjects = new Set(upcomingExams.map((e) => e.subjectId));
  for (const s of subjects) {
    if (examSubjects.has(s.id)) continue;
    const targetMin = s.priority * 45 * Math.ceil(horizon / 7);
    const credit = takeCredit(s.id, targetMin);
    items.push({
      key: `ongoing:${s.id}`,
      subjectId: s.id,
      kind: "ongoing",
      label: `${s.name} upkeep`,
      deadlineIdx: horizon - 1,
      targetSlots: slotsFor(targetMin),
      remainingSlots: slotsFor(targetMin - credit),
      cutSlots: 0,
      weight: 0.25 + 0.05 * s.priority,
    });
  }

  // ---- slot grid ----
  type Cell = { item: WorkItem; kind: SessionKind } | null;
  const grid: Cell[][] = daySlots.map((n) => Array<Cell>(n).fill(null));

  // reserve revision the day before each exam (first slots of the day)
  for (const item of items) {
    if (item.kind !== "exam") continue;
    const revIdx = item.blockedIdx! - 1;
    if (revIdx < 0 || revIdx >= horizon) continue;
    const s = subjectById.get(item.subjectId)!;
    let want = Math.min(s.difficulty >= 4 ? 2 : 1, item.remainingSlots);
    for (let k = 0; k < grid[revIdx].length && want > 0; k++) {
      if (grid[revIdx][k]) continue;
      grid[revIdx][k] = { item, kind: "revision" };
      item.remainingSlots--;
      want--;
    }
  }

  // free slots from (day, slot) through deadline day — the denominator of "pressure"
  const freeFrom = (day: number, slot: number, deadline: number) => {
    let n = 0;
    for (let d = day; d <= deadline && d < horizon; d++) {
      const cells = grid[d];
      for (let k = d === day ? slot : 0; k < cells.length; k++) if (!cells[k]) n++;
    }
    return n;
  };

  // feasibility: for every deadline, work due by then must fit in the free slots before it.
  // Assignments are hard requirements; exam prep is trimmed proportionally when overloaded.
  const deadlines = [...new Set(items.map((i) => i.deadlineIdx).filter((d) => d >= 0))].sort((a, b) => a - b);
  const trim = (pool: WorkItem[], excess: number) => {
    const flexible = pool.filter((i) => i.kind !== "assignment" && i.remainingSlots > 1);
    const flexTotal = flexible.reduce((a, i) => a + i.remainingSlots - 1, 0);
    const goal = excess;
    for (const it of flexible) {
      if (excess <= 0 || flexTotal <= 0) break;
      const cut = Math.min(it.remainingSlots - 1, excess, Math.ceil(((it.remainingSlots - 1) / flexTotal) * goal));
      it.remainingSlots -= cut;
      it.cutSlots += cut;
      excess -= cut;
    }
    return excess;
  };
  let prevD = -1;
  for (const D of deadlines) {
    const due = items.filter((i) => i.deadlineIdx >= 0 && i.deadlineIdx <= D);
    const demand = due.reduce((a, i) => a + i.remainingSlots, 0);
    const room = Math.floor(freeFrom(0, 0, D) * LOAD_CEILING);
    let excess = demand - room;
    // the items that made this window overflow absorb the cut first; earlier ones only if unavoidable
    if (excess > 0) excess = trim(due.filter((i) => i.deadlineIdx > prevD), excess);
    if (excess > 0) trim(due, excess);
    prevD = D;
  }

  const lastStudied = new Map<string, number>();
  for (let d = 0; d < horizon; d++) {
    const cells = grid[d];
    for (let k = 0; k < cells.length; k++) {
      if (cells[k]) continue;
      const prev = k > 0 ? cells[k - 1] : null;
      const perSubjectToday = new Map<string, number>();
      for (const c of cells) if (c) perSubjectToday.set(c.item.subjectId, (perSubjectToday.get(c.item.subjectId) ?? 0) + 1);

      let best: WorkItem | null = null;
      let bestScore = 0;
      for (const it of items) {
        if (it.remainingSlots <= 0 || d > it.deadlineIdx || d === it.blockedIdx) continue;
        const free = freeFrom(d, k, it.deadlineIdx);
        if (free <= 0) continue;
        const pressure = it.remainingSlots / free;
        let score = pressure * it.weight;
        if (pressure >= MUST_DO_PRESSURE) score += 10;
        else {
          // spacing effect: favour subjects not touched for a few days
          const gap = d - (lastStudied.get(it.subjectId) ?? -3);
          score *= 1 + 0.15 * Math.min(Math.max(gap, 0), 3);
          if (prev?.item.subjectId === it.subjectId) score *= 0.55;
          if ((perSubjectToday.get(it.subjectId) ?? 0) >= 2) score *= 0.35;
        }
        if (score > bestScore) {
          bestScore = score;
          best = it;
        }
      }
      if (!best) continue;
      const effectiveTarget = best.targetSlots - best.cutSlots;
      const doneSoFar = effectiveTarget - best.remainingSlots;
      const kind: SessionKind =
        best.kind === "assignment"
          ? "assignment"
          : best.kind === "ongoing"
            ? "review"
            : doneSoFar < effectiveTarget * 0.6
              ? "learn"
              : "practice";
      cells[k] = { item: best, kind };
      best.remainingSlots--;
      lastStudied.set(best.subjectId, d);
    }
  }

  // catch-up pass: slots left empty by the safety buffer go back to trimmed exam prep
  for (let d = 0; d < horizon; d++) {
    const cells = grid[d];
    for (let k = 0; k < cells.length; k++) {
      if (cells[k]) continue;
      const prev = k > 0 ? cells[k - 1] : null;
      const pick = items
        .filter((it) => it.cutSlots > 0 && d <= it.deadlineIdx && d !== it.blockedIdx)
        .sort((x, y) => Number(prev?.item === x) - Number(prev?.item === y) || x.deadlineIdx - y.deadlineIdx)[0];
      if (!pick) continue;
      cells[k] = { item: pick, kind: pick.kind === "ongoing" ? "review" : "practice" };
      pick.cutSlots--;
    }
  }

  // energy-aware ordering: hardest work goes into the student's peak hours of each day.
  // A same-day energy check-in overrides the general preference (low = ease in, high = hardest first).
  const kindLoad: Record<SessionKind, number> = { learn: 3, assignment: 2.5, practice: 2, revision: 1.5, review: 1 };
  const load = (c: Cell) => (c ? kindLoad[c.kind] * (subjectById.get(c.item.subjectId)!.difficulty / 3) : -1);
  grid.forEach((cells, d) => {
    const checkIn = input.dayEnergy?.[dates[d]];
    const mode = checkIn === "low" ? "night" : checkIn === "high" ? "morning" : (prefs.energy ?? "balanced");
    if (mode === "balanced") return;
    const hasPartial = partialMinutes[d] > 0;
    const full = hasPartial ? cells.slice(0, -1) : cells.slice();
    full.sort((x, y) => (mode === "morning" ? load(y) - load(x) : load(x) - load(y)));
    grid[d] = hasPartial ? [...full, cells[cells.length - 1]] : full;
  });

  // ---- materialise sessions ----
  const topicCursor = new Map<string, number>();
  const nextTopic = (s: Subject) => {
    if (!s.topics.length) return null;
    const i = topicCursor.get(s.id) ?? 0;
    topicCursor.set(s.id, i + 1);
    return s.topics[i % s.topics.length];
  };

  const sessions: Session[] = [];
  let bufferSlots = 0;
  grid.forEach((cells, d) => {
    cells.forEach((cell, k) => {
      if (!cell) {
        bufferSlots++;
        return;
      }
      const s = subjectById.get(cell.item.subjectId)!;
      const start = addMinutes(dayStart[d], (k + startOffsetSlots[d]) * slotLen);
      const minutes = partialMinutes[d] && k === cells.length - 1 ? partialMinutes[d] : prefs.sessionMinutes;
      const topic = cell.kind === "learn" || cell.kind === "practice" || cell.kind === "review" ? nextTopic(s) : null;
      const title =
        cell.kind === "assignment"
          ? cell.item.label
          : cell.kind === "revision"
            ? `Full revision + formula sheet`
            : cell.kind === "practice"
              ? `Practice${topic ? `: ${topic}` : " questions & past papers"}`
              : cell.kind === "review"
                ? `Review${topic ? `: ${topic}` : " notes"}`
                : `Learn${topic ? `: ${topic}` : " new material"}`;
      sessions.push({
        id: `${dates[d]}#${k + startOffsetSlots[d]}`,
        date: dates[d],
        start,
        end: addMinutes(start, minutes),
        minutes,
        subjectId: s.id,
        kind: cell.kind,
        title,
        examId: cell.item.examId,
        assignmentId: cell.item.assignmentId,
      });
    });
  });

  // ---- warnings ----
  for (const it of items) {
    const short = it.remainingSlots + it.cutSlots;
    if (short <= 0 || it.kind === "ongoing" || it.deadlineIdx < 0) continue;
    const shortH = ((short * prefs.sessionMinutes) / 60).toFixed(1);
    const name = subjectById.get(it.subjectId)!.name;
    warnings.push({
      level: it.kind === "assignment" ? "danger" : "warn",
      message:
        it.kind === "assignment"
          ? `"${it.label}" (${name}) needs ${shortH}h more than you have before it's due. Add hours or start today.`
          : `${name} gets ${shortH}h less than the recommended prep before ${it.label}. Add study hours to close the gap.`,
    });
  }
  for (const e of upcomingExams) {
    const days = daysBetween(today, e.date);
    if (days <= 2) {
      warnings.push({
        level: "info",
        message: `${subjectById.get(e.subjectId)!.name} exam is ${days === 0 ? "today" : days === 1 ? "tomorrow" : "in 2 days"}. Focus on revision, not new topics.`,
      });
    }
  }
  const denseDays = sessions.reduce<Record<string, number>>((m, s) => ((m[s.date] = (m[s.date] ?? 0) + s.minutes), m), {});
  const heavy = Object.entries(denseDays).filter(([, m]) => m >= 6 * 60).length;
  if (heavy >= 3) {
    warnings.push({ level: "info", message: `${heavy} days have 6h+ of study. Watch for burnout and keep breaks.` });
  }

  // ---- stats ----
  const stats: SubjectStat[] = subjects.map((s) => {
    const planned = sessions.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0);
    const done = completed.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0);
    const target = items
      .filter((i) => i.subjectId === s.id)
      .reduce((a, i) => a + i.targetSlots * prefs.sessionMinutes, 0);
    const nextExam = upcomingExams.find((e) => e.subjectId === s.id)?.date;
    return {
      subjectId: s.id,
      targetMinutes: target,
      plannedMinutes: planned,
      completedMinutes: done,
      nextExam,
      daysLeft: nextExam ? daysBetween(today, nextExam) : undefined,
    };
  });

  return {
    today,
    endDate: dates[dates.length - 1],
    sessions,
    warnings,
    stats,
    totalCapacityMinutes,
    bufferMinutes: bufferSlots * prefs.sessionMinutes,
  };
}
