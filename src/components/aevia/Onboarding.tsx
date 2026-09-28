"use client";

import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ParseResult } from "@/lib/ai";
import { demoHistory, demoInput } from "@/lib/demo";
import { answersToInput, HAS_SEMESTERS, spreadExamDates, suggestedSubjects, TRACKS, type OnboardingAnswers } from "@/lib/onboarding";
import { mergeParsed } from "@/lib/ops";
import { fromISO, toISO } from "@/lib/scheduler";
import type { Level } from "@/lib/types";
import { callAI, saveSession } from "@/lib/usePlanner";
import { Arrow } from "./Mark";

const LEVELS = Object.keys(TRACKS);
const FOCUS = ["Early morning", "Afternoon", "Evening", "Late night"] as const;
const FOCUS_MAP: Record<(typeof FOCUS)[number], Pick<OnboardingAnswers, "studyTime" | "energy">> = {
  "Early morning": { studyTime: "morning", energy: "morning" },
  Afternoon: { studyTime: "afternoon", energy: "balanced" },
  Evening: { studyTime: "evening", energy: "balanced" },
  "Late night": { studyTime: "night", energy: "night" },
};
const CONFIDENCE: { label: string; value: Level }[] = [
  { label: "Shaky", value: 2 },
  { label: "Okay", value: 3 },
  { label: "Strong", value: 4 },
];

type Subj = { name: string; topics: string[]; difficulty: Level; confidence: Level; on: boolean };

function Chips<T extends string | number>({
  label,
  options,
  value,
  onPick,
  format = (x) => String(x),
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onPick: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onPick(o)}>
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function Onboarding() {
  const router = useRouter();
  const today = toISO(new Date());
  const [level, setLevel] = useState<string | null>(null);
  const [focus, setFocus] = useState<(typeof FOCUS)[number] | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subj[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [examStart, setExamStart] = useState(toISO(addDays(fromISO(today), 10)));
  const [examGap, setExamGap] = useState<number | "none">(2);
  const [weekday, setWeekday] = useState<number | null>(3);
  const [weekend, setWeekend] = useState<number | null>(5);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courses = level ? TRACKS[level] : [];
  const needsSemester = !!course && HAS_SEMESTERS.has(course);
  const chosen = subjects.filter((s) => s.on);
  const ready = !!level && !!focus && chosen.length > 0;

  const loadSubjects = (c: string, sem: number) =>
    setSubjects(suggestedSubjects(c, sem).map((s) => ({ ...s, confidence: 3 as Level, on: true })));

  const pickCourse = (c: string) => {
    setCourse(c);
    if (HAS_SEMESTERS.has(c)) {
      if (semester) loadSubjects(c, semester);
      else setSubjects([]);
    } else loadSubjects(c, 1);
  };

  const addSubject = () => {
    const n = newSubject.trim();
    if (!n || subjects.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
    setSubjects([...subjects, { name: n, topics: [], difficulty: 3, confidence: 3, on: true }]);
    setNewSubject("");
  };

  const q = (n: number) => `Question ${n} of 8`;
  const status = !level || !focus ? "Answer the first two questions to continue." : !chosen.length ? "Pick or add at least one subject." : `${chosen.length} subject${chosen.length > 1 ? "s" : ""}, focusing best in the ${focus.toLowerCase()}. Your plan will start there.`;

  async function finish() {
    if (!ready || !focus) return;
    setBusy(true);
    setError(null);
    const dates = examGap === "none" ? [] : spreadExamDates(chosen.length, examStart, examGap);
    let input = answersToInput({
      name,
      course: course ?? level ?? "",
      semester: semester ?? 1,
      subjects: chosen.map((s, i) => ({ ...s, examDate: dates[i] ?? "" })),
      weekdayHours: weekday ?? 3,
      weekendHours: weekend ?? 5,
      ...FOCUS_MAP[focus],
    });
    if (note.trim()) {
      try {
        input = mergeParsed(input, await callAI<ParseResult>("/api/parse", { text: note, today }));
      } catch {
        // the plan still works without the extra note; the AI may simply be offline
      }
    }
    saveSession({ signedIn: true, input, completed: [], plannedLog: {} });
    router.push("/app");
  }

  function openDemo() {
    const input = demoInput(today);
    saveSession({ signedIn: true, input, ...demoHistory(today, input) });
    router.push("/app");
  }

  return (
    <section id="start">
      <div className="sec-head">
        <div>
          <span className="eyebrow">Get started</span>
          <h2>
            Start your <span className="gold">study plan</span>
          </h2>
        </div>
        <p>A few quick questions to get you going. Pick whatever fits you best today; you can change it later.</p>
      </div>

      <div className="qs">
        <div className="q">
          <span className="eyebrow">{q(1)}</span>
          <h3>What are you studying right now?</h3>
          <Chips
            label="What are you studying right now?"
            options={LEVELS}
            value={level}
            onPick={(v) => {
              setLevel(v);
              setCourse(null);
              setSemester(null);
              setSubjects([]);
            }}
          />
        </div>
        <div className="q">
          <span className="eyebrow">{q(2)}</span>
          <h3>When do you focus best?</h3>
          <Chips label="When do you focus best?" options={FOCUS} value={focus} onPick={setFocus} />
        </div>

        {level && (
          <div className="q fade-up">
            <span className="eyebrow">{q(3)}</span>
            <h3>{courses.length ? "Which course?" : "What are you learning?"}</h3>
            {courses.length ? (
              <Chips label="Which course?" options={[...courses, "Other"]} value={course} onPick={(v) => (v === "Other" ? (setCourse("Other"), setSubjects([])) : pickCourse(v))} />
            ) : (
              <p style={{ color: "var(--muted)" }}>Add the skills or modules you&apos;re working on in question 5.</p>
            )}
          </div>
        )}
        {needsSemester && (
          <div className="q fade-up">
            <span className="eyebrow">{q(4)}</span>
            <h3>Which semester?</h3>
            <Chips
              label="Which semester?"
              options={[1, 2, 3, 4, 5, 6, 7, 8]}
              value={semester}
              format={(n) => `Sem ${n}`}
              onPick={(n) => {
                setSemester(n);
                loadSubjects(course!, n);
              }}
            />
          </div>
        )}

        {level && (
          <div className="q fade-up">
            <span className="eyebrow">{q(5)}</span>
            <h3>Your subjects</h3>
            <p style={{ color: "var(--muted)", fontSize: 15 }}>
              {subjects.length ? "We filled in the usual ones. Tap to remove any, or add your own." : "Add each subject you have an exam or deadline in."}
            </p>
            <div className="chips">
              {subjects.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={s.on}
                  onClick={() => setSubjects(subjects.map((x) => (x.name === s.name ? { ...x, on: !x.on } : x)))}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <form
              className="ob-add"
              onSubmit={(e) => {
                e.preventDefault();
                addSubject();
              }}
            >
              <input className="field" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Add a subject, e.g. Compiler Design" aria-label="Add a subject" />
              <button className="btn btn-ghost" disabled={!newSubject.trim()}>
                Add
              </button>
            </form>
          </div>
        )}

        {chosen.length > 0 && (
          <div className="q fade-up">
            <span className="eyebrow">{q(6)}</span>
            <h3>How confident are you in each?</h3>
            <div className="ob-rows">
              {chosen.map((s) => (
                <div key={s.name} className="ob-row">
                  <span>{s.name}</span>
                  <Chips
                    label={`Confidence in ${s.name}`}
                    options={CONFIDENCE.map((c) => c.label)}
                    value={CONFIDENCE.find((c) => c.value === s.confidence)?.label ?? null}
                    onPick={(label) =>
                      setSubjects(subjects.map((x) => (x.name === s.name ? { ...x, confidence: CONFIDENCE.find((c) => c.label === label)!.value } : x)))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {chosen.length > 0 && (
          <div className="q fade-up">
            <span className="eyebrow">{q(7)}</span>
            <h3>When do your exams start?</h3>
            <label className="ob-field">
              <span>First exam</span>
              <input type="date" className="field" min={today} value={examStart} disabled={examGap === "none"} onChange={(e) => setExamStart(e.target.value || examStart)} />
            </label>
            <Chips
              label="Days between exams"
              options={[1, 2, 3, "none"] as (number | "none")[]}
              value={examGap}
              onPick={setExamGap}
              format={(g) => (g === "none" ? "No exams soon" : `Every ${g} day${g === 1 ? "" : "s"}`)}
            />
            <p style={{ color: "var(--dim)", fontSize: 13 }}>You can set exact dates per subject later.</p>
          </div>
        )}

        {chosen.length > 0 && (
          <div className="q fade-up">
            <span className="eyebrow">{q(8)}</span>
            <h3>How many hours can you study?</h3>
            <div className="ob-rows">
              <div className="ob-row">
                <span>Weekdays</span>
                <Chips label="Weekday hours" options={[1, 2, 3, 4, 5]} value={weekday} onPick={setWeekday} format={(h) => `${h} h`} />
              </div>
              <div className="ob-row">
                <span>Weekends</span>
                <Chips label="Weekend hours" options={[2, 4, 5, 6, 8]} value={weekend} onPick={setWeekend} format={(h) => `${h} h`} />
              </div>
            </div>
          </div>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="q fade-up">
          <span className="eyebrow">Optional</span>
          <h3>Anything else we should know?</h3>
          <textarea
            className="field"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write it the way you'd tell a friend: “OS lab due this Friday, my cousin's wedding is on Sunday, I'm weak in deadlocks.”"
          />
        </div>
      )}

      <div className="go">
        <button type="button" className="btn" disabled={!ready} onClick={() => (setShowSignIn(true), setTimeout(() => document.getElementById("signin")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60))}>
          Build my study plan <Arrow />
        </button>
        <p>{status}</p>
      </div>

      {showSignIn && (
        <div id="signin" className="trust fade-up">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3>Save your plan</h3>
            <p>Sign in so your timetable, progress and streak are waiting for you tomorrow.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="ob-field">
              <span>What should we call you?</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" />
            </label>
            <div className="ob-signin">
              <button type="button" className="btn" disabled={busy} onClick={finish}>
                {busy ? "Building your plan…" : "Continue with Google"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={finish}>
                Continue with college email
              </button>
            </div>
            {error && <p style={{ color: "var(--warn)" }}>{error}</p>}
          </div>
        </div>
      )}

      <p className="ob-demo">
        Just looking around?{" "}
        <button type="button" onClick={openDemo}>
          Open the demo student
        </button>
      </p>
    </section>
  );
}
