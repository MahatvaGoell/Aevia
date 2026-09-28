export type ISODate = string; // YYYY-MM-DD (local)

export type Level = 1 | 2 | 3 | 4 | 5;

export interface Subject {
  id: string;
  name: string;
  color: string;
  priority: Level; // how much it matters to the student
  difficulty: Level; // how hard the subject is
  confidence: Level; // how prepared the student already feels
  topics: string[]; // weakest first
}

export interface Exam {
  id: string;
  subjectId: string;
  date: ISODate;
  title: string;
}

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  dueDate: ISODate;
  estimatedHours: number;
}

export interface DayAvailability {
  hours: number;
  start: string; // HH:mm
}

export interface Preferences {
  weekly: DayAvailability[]; // index 0 = Sunday … 6 = Saturday
  sessionMinutes: number;
  breakMinutes: number;
  energy?: EnergyType; // when the student thinks best
}

export type EnergyType = "morning" | "balanced" | "night";

export interface BlockedDay {
  date: ISODate;
  reason: string;
}

export interface PlannerInput {
  studentName: string;
  subjects: Subject[];
  exams: Exam[];
  assignments: Assignment[];
  prefs: Preferences;
  blocked: BlockedDay[];
  dayOverrides: Record<ISODate, number>; // hours for a specific date
  dayStartOverrides?: Record<ISODate, string>; // HH:mm start for a specific date
  dayEnergy?: Record<ISODate, DayEnergy>; // energy check-in for a specific date
}

export type DayEnergy = "low" | "normal" | "high";

export type SessionKind = "learn" | "practice" | "revision" | "assignment" | "review";

export interface Session {
  id: string;
  date: ISODate;
  start: string; // HH:mm
  end: string; // HH:mm
  minutes: number;
  subjectId: string;
  kind: SessionKind;
  title: string;
  examId?: string;
  assignmentId?: string;
}

export interface CompletedSession extends Session {
  completedAt: string;
}

export interface PlanWarning {
  level: "info" | "warn" | "danger";
  message: string;
}

export interface SubjectStat {
  subjectId: string;
  targetMinutes: number;
  plannedMinutes: number;
  completedMinutes: number;
  nextExam?: ISODate;
  daysLeft?: number;
}

export interface Plan {
  today: ISODate;
  endDate: ISODate;
  sessions: Session[];
  warnings: PlanWarning[];
  stats: SubjectStat[];
  totalCapacityMinutes: number;
  bufferMinutes: number;
}
