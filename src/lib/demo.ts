import { addDays } from "date-fns";
import { addMinutes, fromISO, toISO } from "./scheduler";
import type { CompletedSession, ISODate, PlannerInput, Preferences } from "./types";

export const SUBJECT_COLORS = [
  "#C9A176", // bronze
  "#A7C08F", // sage
  "#9DB4C9", // slate blue
  "#DE9670", // ember
  "#C7A4C2", // heather
  "#D9C27E", // straw
  "#8FB5A8", // verdigris
  "#C98E86", // rosewood
];

export const DEFAULT_PREFS: Preferences = {
  weekly: [
    { hours: 5, start: "10:00" }, // Sun
    { hours: 3, start: "17:00" },
    { hours: 3, start: "17:00" },
    { hours: 3, start: "17:00" },
    { hours: 3, start: "17:00" },
    { hours: 2, start: "17:00" },
    { hours: 5, start: "10:00" }, // Sat
  ],
  sessionMinutes: 50,
  breakMinutes: 10,
  energy: "balanced",
};

export const EMPTY_INPUT: PlannerInput = {
  studentName: "",
  subjects: [],
  exams: [],
  assignments: [],
  prefs: DEFAULT_PREFS,
  blocked: [],
  dayOverrides: {},
};

/** A realistic B.Tech mid-sem scenario, dated relative to today so the demo never goes stale. */
export function demoInput(today: ISODate): PlannerInput {
  const d = (n: number) => toISO(addDays(fromISO(today), n));
  return {
    studentName: "Aarav",
    subjects: [
      { id: "dbms", name: "DBMS", color: SUBJECT_COLORS[0], priority: 5, difficulty: 4, confidence: 2, topics: ["Normalization", "Transactions & ACID", "SQL joins", "Indexing & B+ trees", "ER modelling"] },
      { id: "os", name: "Operating Systems", color: SUBJECT_COLORS[1], priority: 4, difficulty: 4, confidence: 3, topics: ["CPU scheduling", "Deadlocks", "Paging & segmentation", "Semaphores"] },
      { id: "maths", name: "Discrete Maths", color: SUBJECT_COLORS[2], priority: 3, difficulty: 3, confidence: 4, topics: ["Graph theory", "Recurrences", "Propositional logic"] },
      { id: "cn", name: "Computer Networks", color: SUBJECT_COLORS[3], priority: 4, difficulty: 3, confidence: 2, topics: ["TCP vs UDP", "Subnetting", "Routing algorithms", "OSI layers"] },
      { id: "evs", name: "EVS", color: SUBJECT_COLORS[4], priority: 1, difficulty: 1, confidence: 4, topics: ["Ecosystems", "Pollution control"] },
    ],
    exams: [
      { id: "ex-dbms", subjectId: "dbms", date: d(9), title: "DBMS mid-sem" },
      { id: "ex-os", subjectId: "os", date: d(12), title: "OS mid-sem" },
      { id: "ex-maths", subjectId: "maths", date: d(15), title: "Discrete Maths mid-sem" },
      { id: "ex-cn", subjectId: "cn", date: d(18), title: "CN mid-sem" },
    ],
    assignments: [
      { id: "as-os", subjectId: "os", title: "OS lab: Banker's algorithm", dueDate: d(3), estimatedHours: 3 },
      { id: "as-cn", subjectId: "cn", title: "CN assignment: subnetting sheet", dueDate: d(7), estimatedHours: 2 },
    ],
    prefs: DEFAULT_PREFS,
    blocked: [{ date: d(5), reason: "Cousin's wedding" }],
    dayOverrides: {},
  };
}

/** Six days of realistic past activity for the demo student, so Momentum and Forecast have something to read. */
export function demoHistory(today: ISODate, input: PlannerInput) {
  const fractions = [1, 0.67, 1, 0.34, 0.67, 1];
  const rotation = ["dbms", "os", "cn", "maths", "dbms", "os", "cn", "dbms"];
  const completed: CompletedSession[] = [];
  const plannedLog: Record<ISODate, number> = {};
  let r = 0;
  fractions.forEach((f, i) => {
    const date = toISO(addDays(fromISO(today), i - 6));
    const avail = input.prefs.weekly[fromISO(date).getDay()];
    const slots = Math.floor((avail.hours * 60 + input.prefs.breakMinutes) / (input.prefs.sessionMinutes + input.prefs.breakMinutes));
    plannedLog[date] = slots * input.prefs.sessionMinutes;
    const done = Math.round(slots * f);
    for (let k = 0; k < done; k++) {
      const subjectId = rotation[r++ % rotation.length];
      const subject = input.subjects.find((s) => s.id === subjectId)!;
      const start = addMinutes(avail.start, k * (input.prefs.sessionMinutes + input.prefs.breakMinutes));
      completed.push({
        id: `done:hist-${date}-${k}`,
        date,
        start,
        end: addMinutes(start, input.prefs.sessionMinutes),
        minutes: input.prefs.sessionMinutes,
        subjectId,
        kind: "learn",
        title: `Learn: ${subject.topics[k % subject.topics.length]}`,
        completedAt: `${date}T20:00:00`,
      });
    }
  });
  return { completed, plannedLog };
}
