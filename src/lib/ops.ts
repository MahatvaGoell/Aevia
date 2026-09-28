import { SUBJECT_COLORS } from "./demo";
import type { Level, PlannerInput, Subject } from "./types";
import type { AdjustResult, ParseResult } from "./ai";

const clampLevel = (n: number | null | undefined, fallback: Level = 3): Level =>
  (n == null || Number.isNaN(n) ? fallback : Math.min(5, Math.max(1, Math.round(n)))) as Level;

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const examTitle = (t: string | null | undefined, subject: string) =>
  !t || /^(the\s+)?(final\s+|mid-?sem\s+)?exam$/i.test(t.trim()) ? `${subject} exam` : t;
const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function findSubject(input: PlannerInput, name: string | null | undefined): Subject | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    input.subjects.find((s) => s.name.toLowerCase() === n) ??
    input.subjects.find((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase()))
  );
}

function ensureSubject(input: PlannerInput, name: string, init?: Partial<Subject>): Subject {
  const existing = findSubject(input, name);
  if (existing) return existing;
  const s: Subject = {
    id: uid("sub"),
    name: name.trim(),
    color: SUBJECT_COLORS[input.subjects.length % SUBJECT_COLORS.length],
    priority: 3,
    difficulty: 3,
    confidence: 3,
    topics: [],
    ...init,
  };
  input.subjects.push(s);
  return s;
}

/** Merge AI-parsed free text into the current planner input (adds, never deletes). */
export function mergeParsed(base: PlannerInput, p: ParseResult): PlannerInput {
  const input: PlannerInput = structuredClone(base);
  if (p.studentName) input.studentName = p.studentName;

  for (const s of p.subjects) {
    const subj = ensureSubject(input, s.name);
    subj.priority = clampLevel(s.priority);
    subj.difficulty = clampLevel(s.difficulty);
    subj.confidence = clampLevel(s.confidence);
    if (s.topics.length) subj.topics = s.topics;
  }
  for (const e of p.exams) {
    if (!isDate(e.date)) continue;
    const subj = ensureSubject(input, e.subjectName);
    const existing = input.exams.find((x) => x.subjectId === subj.id);
    if (existing) Object.assign(existing, { date: e.date, title: examTitle(e.title, subj.name) });
    else input.exams.push({ id: uid("ex"), subjectId: subj.id, date: e.date, title: examTitle(e.title, subj.name) });
  }
  for (const a of p.assignments) {
    if (!isDate(a.dueDate)) continue;
    const subj = ensureSubject(input, a.subjectName);
    input.assignments.push({
      id: uid("as"),
      subjectId: subj.id,
      title: a.title,
      dueDate: a.dueDate,
      estimatedHours: Math.max(0.5, a.estimatedHours || 2),
    });
  }
  const { weekdayHours, weekendHours, weekdayStart, weekendStart } = p.availability;
  input.prefs.weekly = input.prefs.weekly.map((d, i) => {
    const weekend = i === 0 || i === 6;
    const hours = weekend ? weekendHours : weekdayHours;
    const start = weekend ? weekendStart : weekdayStart;
    return { hours: hours ?? d.hours, start: start && /^\d{1,2}:\d{2}$/.test(start) ? start.padStart(5, "0") : d.start };
  });
  for (const b of p.blockedDates) {
    if (isDate(b.date) && !input.blocked.some((x) => x.date === b.date)) input.blocked.push(b);
  }
  return input;
}

/** Apply AI rescheduling operations. Returns the new input plus a human log of what changed. */
export function applyOps(base: PlannerInput, ops: AdjustResult["operations"]): { input: PlannerInput; log: string[] } {
  const input: PlannerInput = structuredClone(base);
  const log: string[] = [];
  for (const o of ops) {
    switch (o.op) {
      case "block_day":
        if (isDate(o.date) && !input.blocked.some((b) => b.date === o.date)) {
          input.blocked.push({ date: o.date, reason: o.reason || "Unavailable" });
          log.push(`Blocked ${o.date}`);
        }
        break;
      case "unblock_day":
        if (isDate(o.date)) {
          input.blocked = input.blocked.filter((b) => b.date !== o.date);
          log.push(`Unblocked ${o.date}`);
        }
        break;
      case "set_day_hours":
        if (isDate(o.date) && o.hours != null) {
          input.dayOverrides[o.date] = Math.max(0, o.hours);
          log.push(`${o.date}: ${o.hours}h`);
        }
        break;
      case "set_weekday_hours":
      case "set_weekend_hours":
        if (o.hours != null) {
          const weekend = o.op === "set_weekend_hours";
          input.prefs.weekly = input.prefs.weekly.map((d, i) =>
            (i === 0 || i === 6) === weekend ? { ...d, hours: Math.max(0, o.hours!) } : d,
          );
          log.push(`${weekend ? "Weekends" : "Weekdays"}: ${o.hours}h/day`);
        }
        break;
      case "update_subject": {
        const s = findSubject(input, o.subjectName);
        if (!s) break;
        if (o.priority != null) s.priority = clampLevel(o.priority);
        if (o.difficulty != null) s.difficulty = clampLevel(o.difficulty);
        if (o.confidence != null) s.confidence = clampLevel(o.confidence);
        log.push(`Updated ${s.name}`);
        break;
      }
      case "move_exam": {
        const s = findSubject(input, o.subjectName);
        const e = s && input.exams.find((x) => x.subjectId === s.id);
        if (e && isDate(o.date)) {
          e.date = o.date;
          log.push(`${s!.name} exam → ${o.date}`);
        }
        break;
      }
      case "add_exam":
        if (o.subjectName && isDate(o.date)) {
          const s = ensureSubject(input, o.subjectName);
          input.exams.push({ id: uid("ex"), subjectId: s.id, date: o.date, title: o.title || `${s.name} exam` });
          log.push(`Added ${s.name} exam on ${o.date}`);
        }
        break;
      case "add_assignment":
        if (o.subjectName && isDate(o.date)) {
          const s = ensureSubject(input, o.subjectName);
          input.assignments.push({
            id: uid("as"),
            subjectId: s.id,
            title: o.title || `${s.name} assignment`,
            dueDate: o.date,
            estimatedHours: Math.max(0.5, o.estimatedHours ?? 2),
          });
          log.push(`Added "${o.title}" due ${o.date}`);
        }
        break;
      case "remove_assignment": {
        const t = (o.title || "").toLowerCase();
        const before = input.assignments.length;
        input.assignments = input.assignments.filter((a) => !t || !a.title.toLowerCase().includes(t));
        if (input.assignments.length < before) log.push(`Removed "${o.title}"`);
        break;
      }
      case "add_subject":
        if (o.subjectName) {
          ensureSubject(input, o.subjectName, {
            priority: clampLevel(o.priority),
            difficulty: clampLevel(o.difficulty),
            confidence: clampLevel(o.confidence),
          });
          log.push(`Added ${o.subjectName}`);
        }
        break;
    }
  }
  return { input, log };
}
