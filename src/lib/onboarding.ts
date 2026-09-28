import { addDays } from "date-fns";
import { DEFAULT_PREFS, SUBJECT_COLORS } from "./demo";
import { fromISO, toISO } from "./scheduler";
import type { EnergyType, ISODate, Level, PlannerInput } from "./types";

/** Typical subjects per course and semester, so onboarding is a few taps instead of typing. */
const CATALOG: Record<string, Record<number, { name: string; topics: string[]; difficulty: Level }[]>> = {
  "B.Tech CSE": {
    1: [
      { name: "Engineering Mathematics I", topics: ["Matrices", "Differential calculus", "Integral calculus"], difficulty: 4 },
      { name: "Engineering Physics", topics: ["Optics", "Quantum mechanics", "Semiconductors"], difficulty: 3 },
      { name: "Programming in C", topics: ["Pointers", "Arrays & strings", "Functions", "Structures"], difficulty: 3 },
      { name: "Basic Electrical Engineering", topics: ["DC circuits", "AC circuits", "Transformers"], difficulty: 3 },
    ],
    2: [
      { name: "Engineering Mathematics II", topics: ["Vector calculus", "ODEs", "Laplace transforms"], difficulty: 4 },
      { name: "Data Structures", topics: ["Linked lists", "Stacks & queues", "Trees", "Sorting"], difficulty: 4 },
      { name: "Digital Electronics", topics: ["Boolean algebra", "K-maps", "Flip-flops", "Counters"], difficulty: 3 },
      { name: "Engineering Chemistry", topics: ["Electrochemistry", "Polymers", "Water treatment"], difficulty: 2 },
    ],
    3: [
      { name: "DBMS", topics: ["Normalization", "SQL joins", "Transactions & ACID", "ER modelling"], difficulty: 4 },
      { name: "Discrete Mathematics", topics: ["Graph theory", "Recurrences", "Propositional logic"], difficulty: 3 },
      { name: "Object Oriented Programming", topics: ["Inheritance", "Polymorphism", "Exception handling"], difficulty: 3 },
      { name: "Computer Organization", topics: ["Instruction sets", "Pipelining", "Memory hierarchy"], difficulty: 4 },
    ],
    4: [
      { name: "Operating Systems", topics: ["CPU scheduling", "Deadlocks", "Paging", "Semaphores"], difficulty: 4 },
      { name: "Design & Analysis of Algorithms", topics: ["Divide & conquer", "Dynamic programming", "Greedy", "Graphs"], difficulty: 5 },
      { name: "Computer Networks", topics: ["OSI layers", "TCP vs UDP", "Subnetting", "Routing"], difficulty: 3 },
      { name: "Theory of Computation", topics: ["Finite automata", "Regular expressions", "CFGs", "Turing machines"], difficulty: 5 },
    ],
    5: [
      { name: "Compiler Design", topics: ["Lexical analysis", "Parsing", "Syntax-directed translation"], difficulty: 5 },
      { name: "Software Engineering", topics: ["SDLC models", "UML", "Testing"], difficulty: 2 },
      { name: "Artificial Intelligence", topics: ["Search", "Knowledge representation", "Probabilistic reasoning"], difficulty: 4 },
      { name: "Web Technologies", topics: ["HTTP", "JavaScript", "REST APIs"], difficulty: 2 },
    ],
    6: [
      { name: "Machine Learning", topics: ["Regression", "Classification", "Clustering", "Neural networks"], difficulty: 4 },
      { name: "Cloud Computing", topics: ["Virtualization", "Service models", "Containers"], difficulty: 3 },
      { name: "Information Security", topics: ["Cryptography", "Authentication", "Network attacks"], difficulty: 4 },
      { name: "Distributed Systems", topics: ["Consistency", "Consensus", "Replication"], difficulty: 5 },
    ],
  },
  BCA: {
    1: [
      { name: "Mathematics I", topics: ["Sets", "Matrices", "Calculus basics"], difficulty: 3 },
      { name: "C Programming", topics: ["Loops", "Arrays", "Pointers"], difficulty: 3 },
      { name: "Computer Fundamentals", topics: ["Number systems", "Hardware", "Operating systems basics"], difficulty: 2 },
    ],
    3: [
      { name: "Data Structures", topics: ["Stacks", "Queues", "Trees"], difficulty: 4 },
      { name: "DBMS", topics: ["ER model", "SQL", "Normalization"], difficulty: 3 },
      { name: "Java Programming", topics: ["OOP", "Collections", "Exceptions"], difficulty: 3 },
    ],
    5: [
      { name: "Computer Networks", topics: ["OSI model", "IP addressing", "Protocols"], difficulty: 3 },
      { name: "Web Development", topics: ["HTML/CSS", "JavaScript", "PHP"], difficulty: 2 },
      { name: "Software Engineering", topics: ["SDLC", "Testing", "Project management"], difficulty: 2 },
    ],
  },
  BBA: {
    1: [
      { name: "Principles of Management", topics: ["Planning", "Organising", "Controlling"], difficulty: 2 },
      { name: "Business Economics", topics: ["Demand & supply", "Elasticity", "Market structures"], difficulty: 3 },
      { name: "Financial Accounting", topics: ["Journal entries", "Ledgers", "Final accounts"], difficulty: 3 },
    ],
    3: [
      { name: "Marketing Management", topics: ["4 Ps", "Segmentation", "Consumer behaviour"], difficulty: 2 },
      { name: "Business Statistics", topics: ["Probability", "Regression", "Hypothesis testing"], difficulty: 4 },
      { name: "Cost Accounting", topics: ["Costing methods", "Budgeting", "Variance analysis"], difficulty: 3 },
    ],
  },
  "B.Com": {
    1: [
      { name: "Financial Accounting", topics: ["Journal", "Ledger", "Trial balance"], difficulty: 3 },
      { name: "Business Law", topics: ["Contract Act", "Sale of Goods Act"], difficulty: 2 },
      { name: "Micro Economics", topics: ["Utility", "Demand", "Production"], difficulty: 3 },
    ],
  },
};

// school, competitive and skill tracks have no semesters; they live under key 1
Object.assign(CATALOG, {
  "Class 10 Boards": {
    1: [
      { name: "Mathematics", topics: ["Quadratic equations", "Trigonometry", "Statistics"], difficulty: 4 },
      { name: "Science", topics: ["Chemical reactions", "Electricity", "Life processes"], difficulty: 3 },
      { name: "Social Science", topics: ["Nationalism", "Resources", "Democracy"], difficulty: 2 },
      { name: "English", topics: ["Grammar", "Writing", "Literature"], difficulty: 2 },
    ],
  },
  "Class 12 Science": {
    1: [
      { name: "Physics", topics: ["Electrostatics", "Optics", "Modern physics"], difficulty: 5 },
      { name: "Chemistry", topics: ["Electrochemistry", "Organic reactions", "Coordination compounds"], difficulty: 4 },
      { name: "Mathematics", topics: ["Calculus", "Vectors & 3D", "Probability"], difficulty: 5 },
      { name: "English", topics: ["Reading", "Writing", "Literature"], difficulty: 2 },
    ],
  },
  "Class 12 Commerce": {
    1: [
      { name: "Accountancy", topics: ["Partnership", "Company accounts", "Cash flow"], difficulty: 4 },
      { name: "Business Studies", topics: ["Management principles", "Marketing", "Finance"], difficulty: 2 },
      { name: "Economics", topics: ["National income", "Money & banking", "Demand"], difficulty: 3 },
    ],
  },
  JEE: {
    1: [
      { name: "Physics", topics: ["Mechanics", "Electromagnetism", "Modern physics"], difficulty: 5 },
      { name: "Chemistry", topics: ["Physical chemistry", "Organic chemistry", "Inorganic chemistry"], difficulty: 4 },
      { name: "Mathematics", topics: ["Calculus", "Algebra", "Coordinate geometry"], difficulty: 5 },
    ],
  },
  NEET: {
    1: [
      { name: "Biology", topics: ["Human physiology", "Genetics", "Plant physiology"], difficulty: 4 },
      { name: "Physics", topics: ["Mechanics", "Optics", "Electricity"], difficulty: 5 },
      { name: "Chemistry", topics: ["Organic chemistry", "Chemical bonding", "Equilibrium"], difficulty: 4 },
    ],
  },
  CAT: {
    1: [
      { name: "Quantitative Aptitude", topics: ["Arithmetic", "Algebra", "Geometry"], difficulty: 4 },
      { name: "VARC", topics: ["Reading comprehension", "Para jumbles", "Summaries"], difficulty: 3 },
      { name: "DILR", topics: ["Data interpretation", "Arrangements", "Games & tournaments"], difficulty: 4 },
    ],
  },
  "GATE CSE": {
    1: [
      { name: "Data Structures & Algorithms", topics: ["Trees", "Graphs", "Dynamic programming"], difficulty: 5 },
      { name: "Operating Systems", topics: ["Scheduling", "Memory management", "Synchronization"], difficulty: 4 },
      { name: "DBMS", topics: ["Normalization", "Transactions", "SQL"], difficulty: 3 },
      { name: "Theory of Computation", topics: ["Automata", "Grammars", "Decidability"], difficulty: 5 },
    ],
  },
});

/** Course choices per answer to "What are you studying right now?" */
export const TRACKS: Record<string, string[]> = {
  "School (Class 9–12)": ["Class 10 Boards", "Class 12 Science", "Class 12 Commerce"],
  College: ["B.Tech CSE", "BCA", "BBA", "B.Com"],
  "Competitive exam": ["JEE", "NEET", "CAT", "GATE CSE"],
  "Learning a new skill": [],
};
export const HAS_SEMESTERS = new Set(["B.Tech CSE", "BCA", "BBA", "B.Com"]);

export const COURSES = [...Object.keys(CATALOG), "Other"];

export function suggestedSubjects(course: string, semester: number) {
  const bySem = CATALOG[course];
  if (!bySem) return [];
  // fall back to the nearest listed semester at or below the chosen one
  const sems = Object.keys(bySem).map(Number).sort((a, b) => a - b);
  const sem = [...sems].reverse().find((s) => s <= semester) ?? sems[0];
  return bySem[sem] ?? [];
}

export interface OnboardingSubject {
  name: string;
  topics: string[];
  difficulty: Level;
  confidence: Level;
  examDate: ISODate | "";
}

export interface OnboardingAnswers {
  name: string;
  course: string;
  semester: number;
  subjects: OnboardingSubject[];
  weekdayHours: number;
  weekendHours: number;
  studyTime: "morning" | "afternoon" | "evening" | "night";
  energy: EnergyType;
}

/** Spread exams one every `gap` days from `start`, in the order given. */
export function spreadExamDates(count: number, start: ISODate, gap: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => toISO(addDays(fromISO(start), i * gap)));
}

const START: Record<OnboardingAnswers["studyTime"], { weekday: string; weekend: string }> = {
  morning: { weekday: "06:30", weekend: "08:00" },
  afternoon: { weekday: "15:00", weekend: "13:00" },
  evening: { weekday: "17:00", weekend: "10:00" },
  night: { weekday: "20:00", weekend: "18:00" },
};

export function answersToInput(a: OnboardingAnswers): PlannerInput {
  const start = START[a.studyTime];
  const subjects = a.subjects
    .filter((s) => s.name.trim())
    .map((s, i) => ({
      id: `sub-${i}-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}`,
      name: s.name.trim(),
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      priority: (s.confidence <= 2 ? 4 : 3) as Level,
      difficulty: s.difficulty,
      confidence: s.confidence,
      topics: s.topics,
      examDate: s.examDate,
    }));
  return {
    studentName: a.name.trim(),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      priority: s.priority,
      difficulty: s.difficulty,
      confidence: s.confidence,
      topics: s.topics,
    })),
    exams: subjects
      .filter((s) => s.examDate)
      .map((s) => ({ id: `ex-${s.id}`, subjectId: s.id, date: s.examDate as ISODate, title: `${s.name} exam` })),
    assignments: [],
    prefs: {
      ...DEFAULT_PREFS,
      energy: a.energy,
      weekly: DEFAULT_PREFS.weekly.map((_, i) => {
        const weekend = i === 0 || i === 6;
        return { hours: weekend ? a.weekendHours : a.weekdayHours, start: weekend ? start.weekend : start.weekday };
      }),
    },
    blocked: [],
    dayOverrides: {},
  };
}
