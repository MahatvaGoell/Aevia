"use client";

import { useEffect, useState } from "react";
import { readSession } from "@/lib/usePlanner";
import { MoonArt, Ring } from "./Art";

/* The landing page's dashboard preview, playable: every tile responds, and the rail switches views.
   All data is sample data for a generic student, dated relative to today. */

type View = "home" | "subjects" | "timetable" | "insights" | "ai";
type TrackState = "done" | "open";
interface Track {
  id: number;
  time: string;
  title: string;
  meta: string;
  minutes: number;
  subject: string;
  state: TrackState;
}
interface Subject {
  name: string;
  doneMin: number;
  confidence: number;
  examIn: number;
}

const SUBJECTS: Subject[] = [
  { name: "DBMS", doneMin: 620, confidence: 3, examIn: 9 },
  { name: "Operating Systems", doneMin: 430, confidence: 2, examIn: 6 },
  { name: "Maths III", doneMin: 560, confidence: 4, examIn: 13 },
  { name: "Computer Networks", doneMin: 470, confidence: 3, examIn: 16 },
];
// hours a subject needs grows as confidence drops (the engine's rule, simplified)
const needMin = (s: Subject) => (7 + (5 - s.confidence) * 3) * 60;
const ready = (s: Subject) => Math.min(1, s.doneMin / needMin(s));

const TRACKS: Track[] = [
  { id: 1, time: "16:00", title: "Maths III · Laplace transforms", meta: "45 min · practice set", minutes: 45, subject: "Maths III", state: "done" },
  { id: 2, time: "18:30", title: "DBMS · Normalization to 3NF", meta: "50 min · exam in 9 days", minutes: 50, subject: "DBMS", state: "open" },
  { id: 3, time: "19:35", title: "Operating Systems · Deadlocks", meta: "40 min · confidence 2/5", minutes: 40, subject: "Operating Systems", state: "open" },
  { id: 4, time: "20:30", title: "Networks lab report · final pass", meta: "55 min · due in 3 days", minutes: 55, subject: "Computer Networks", state: "open" },
];

const STATUS = [
  { label: "To do", cls: "p-md" },
  { label: "In progress", cls: "p-in" },
  { label: "Done", cls: "p-ok" },
];
const DEADLINES = [
  { name: "Networks lab report", inDays: 3, pr: ["High", "p-hi"], status: 1 },
  { name: "OS assignment 3", inDays: 7, pr: ["Medium", "p-md"], status: 0 },
  { name: "Maths quiz prep", inDays: 2, pr: ["Medium", "p-md"], status: 2 },
];

const TIPS = [
  "OS is your weakest subject and the closest exam. Do it before dinner, while you're fresh.",
  "You've studied 6 days in a row. Keep tomorrow light so the streak doesn't turn into burnout.",
  "DBMS joins show up in both exams. One practice set today pays off twice.",
];

const WEEK = [55, 80, 62, 48, 30, 70, 20];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const TIMETABLE: { time: string; cells: (string | null)[] }[] = [
  { time: "17:00", cells: ["DBMS · Joins", "OS · Paging", "Maths · Fourier", "DBMS · 3NF", "Revision · OS"] },
  { time: "18:00", cells: ["OS · Scheduling", "CN · Subnetting", null, "OS · Deadlocks", "Revision · OS"] },
  { time: "19:00", cells: ["Maths · Laplace", "DBMS · ER model", "CN lab report", "CN · Routing", null] },
];

const PLAN_MY_DAY: Record<number, [string, string][]> = {
  1: [["19:00 · 50 min", "OS · Deadlocks and Banker's algorithm"]],
  2: [
    ["19:00 · 50 min", "DBMS · Normalization to 3NF"],
    ["19:55 · 45 min", "OS · Deadlocks and Banker's algorithm"],
    ["20:45 · 20 min", "Flashcard recap of both"],
  ],
  3: [
    ["19:00 · 50 min", "OS · Deadlocks and Banker's algorithm"],
    ["20:00 · 50 min", "DBMS · Normalization to 3NF"],
    ["21:00 · 50 min", "CN lab report · final pass"],
    ["21:55 · 20 min", "Flashcard recap"],
  ],
};

const RAIL: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <path d="M2 7l6-5 6 5v7H2z" fill="currentColor" /> },
  {
    id: "subjects",
    label: "Subjects",
    icon: (
      <>
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
        <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
        <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
        <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
      </>
    ),
  },
  {
    id: "timetable",
    label: "Timetable",
    icon: (
      <>
        <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 7h12M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
  { id: "insights", label: "Insights", icon: <path d="M3 13V8M8 13V3M13 13V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> },
  { id: "ai", label: "AI tools", icon: <path d="M8 1l1.8 4.6L14 7l-4.2 1.4L8 13 6.2 8.4 2 7l4.2-1.4z" fill="currentColor" /> },
];

const deadlineIn = (seconds: number) => Date.now() + seconds * 1000;
const secondsUntil = (endAt: number) => Math.max(0, Math.round((endAt - Date.now()) / 1000));
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);

export function DemoDashboard() {
  const [view, setView] = useState<View>("home");
  const [now, setNow] = useState<Date | null>(null);
  const [name, setName] = useState("Student");
  const [tracks, setTracks] = useState(TRACKS);
  const [currentId, setCurrentId] = useState(2);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(true);
  const [subjects, setSubjects] = useState(SUBJECTS);
  const [deadlines, setDeadlines] = useState(DEADLINES);
  const [tip, setTip] = useState(0);
  const [day, setDay] = useState(3);
  const [cellsDone, setCellsDone] = useState<Set<string>>(new Set());
  const [hours, setHours] = useState(2);
  const [skipped, setSkipped] = useState(false);
  // every view keeps the home view's height, so switching views never makes the page below jump
  const [homeH, setHomeH] = useState(0);
  const measureHome = (el: HTMLDivElement | null) => {
    if (el && Math.abs(el.offsetHeight - homeH) > 2) setHomeH(el.offsetHeight);
  };
  const lock = homeH ? { minHeight: homeH, alignContent: "start" as const } : undefined;

  // client-only values (time of day, today's date, the signed-in name) after mount, to avoid hydration mismatches
  useEffect(() => {
    const t = setTimeout(() => {
      const d = new Date();
      setNow(d);
      setDay((d.getDay() + 6) % 7);
      const n = readSession()?.input.studentName?.trim();
      if (n) setName(n);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // focus timer on the current track
  const current = tracks.find((t) => t.id === currentId && t.state === "open") ?? tracks.find((t) => t.state === "open");
  useEffect(() => {
    if (!running || !current) return;
    const endAt = deadlineIn(left);
    const t = setInterval(() => {
      const l = secondsUntil(endAt);
      setLeft(l);
      if (l === 0) {
        // session finished: tick it off and move on
        clearInterval(t);
        completeTrack(current.id);
      }
    }, 1000);
    return () => clearInterval(t);
    // restart only on play/pause or track change; `left` is read once as the starting point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, current?.id]);

  function completeTrack(id: number) {
    const t = tracks.find((x) => x.id === id);
    if (!t) return;
    const next = tracks.map((x) => (x.id === id ? { ...x, state: (x.state === "done" ? "open" : "done") as TrackState } : x));
    setTracks(next);
    if (t.state === "open") {
      setSubjects((ss) => ss.map((s) => (s.name === t.subject ? { ...s, doneMin: s.doneMin + t.minutes } : s)));
      const upcoming = next.find((x) => x.state === "open");
      if (upcoming) {
        setCurrentId(upcoming.id);
        setLeft(upcoming.minutes * 60);
      }
      setRunning(false);
    } else {
      setSubjects((ss) => ss.map((s) => (s.name === t.subject ? { ...s, doneMin: Math.max(0, s.doneMin - t.minutes) } : s)));
    }
  }

  function makeCurrent(id: number) {
    const t = tracks.find((x) => x.id === id);
    if (!t || t.state === "done") return;
    if (id !== current?.id) {
      setCurrentId(id);
      setLeft(t.minutes * 60);
      setRunning(false);
    }
  }

  const doneMin = tracks.filter((t) => t.state === "done").reduce((a, t) => a + t.minutes, 0);
  const plannedMin = tracks.reduce((a, t) => a + t.minutes, 0);
  const hoursWeek = 14.5 + (doneMin - 45) / 60;
  const overall = subjects.reduce((a, s) => a + ready(s) * needMin(s), 0) / subjects.reduce((a, s) => a + needMin(s), 0);
  const hour = now?.getHours() ?? 19;
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateIn = (n: number, style: "long" | "short" = "short") =>
    now
      ? new Date(now.getTime() + n * 86_400_000).toLocaleDateString("en-GB", style === "long" ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short" }).replace(",", "")
      : "";

  return (
    <div className="device" aria-label="Interactive example dashboard with sample data">
      <div className="rail" role="tablist" aria-label="Dashboard views">
        {RAIL.map((r) => (
          <button key={r.id} role="tab" aria-selected={view === r.id} aria-label={r.label} title={r.label} onClick={() => setView(r.id)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {r.icon}
            </svg>
          </button>
        ))}
      </div>

      {view === "home" && (
        <div className="dash demo-view" key="home" ref={measureHome}>
          <div className="tile hello c5">
            <div>
              <span className="example">Example · sample data</span>
              <b style={{ marginTop: 14 }}>
                {greet}, {name}
              </b>
              <small>
                {tracks.length} sessions today · {hm(plannedMin)} planned
              </small>
            </div>
            <MoonArt id="moon" />
          </div>
          <div className="tile stat c4">
            <h4>Hours studied this week</h4>
            <span className="n">{hoursWeek.toFixed(1)}</span>
            <span className="d">▲ {Math.round(18 + (doneMin - 45) / 6)}% vs last week</span>
            <svg viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="sa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#C9A176" stopOpacity=".35" />
                  <stop offset="1" stopColor="#C9A176" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M0 38 L25 34 L50 36 L75 26 L100 30 L125 18 L150 22 L175 10 L200 ${Math.max(2, 6 - (doneMin - 45) / 20)} L200 46 L0 46Z`} fill="url(#sa)" />
              <path d={`M0 38 L25 34 L50 36 L75 26 L100 30 L125 18 L150 22 L175 10 L200 ${Math.max(2, 6 - (doneMin - 45) / 20)}`} fill="none" stroke="#C9A176" strokeWidth="1.6" />
            </svg>
          </div>
          <button className="tile c3 tile-btn" onClick={() => setView("subjects")} aria-label="Exam readiness, open subjects">
            <h4>Exam readiness</h4>
            <div className="readiness">
              <Ring value={overall} id="rg" />
              <p>Target 85% by {dateIn(16, "long")}</p>
            </div>
          </button>

          <div className="tile play c7">
            <h4>Today&apos;s playlist</h4>
            {tracks.map((t) => {
              const isNow = t.id === current?.id;
              const upNext = tracks.find((x) => x.state === "open" && x.id !== current?.id)?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`track ${t.state === "done" ? "done" : isNow ? "now" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => makeCurrent(t.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), makeCurrent(t.id))}
                  aria-label={`${t.title}, ${t.state === "done" ? "done" : isNow ? "current session" : "tap to start"}`}
                >
                  <time>{t.time}</time>
                  <div>
                    {t.title}
                    <em>{t.meta}</em>
                  </div>
                  <span className="track-actions">
                    {isNow ? (
                      <button className="chip" onClick={(e) => (e.stopPropagation(), setRunning((r) => !r))} aria-label={running ? "Pause timer" : "Start timer"}>
                        {running ? `❚❚ ${clock(left)} left` : `▶ ${clock(left)} left`}
                      </button>
                    ) : (
                      <span className="chip">{t.state === "done" ? "✓ Done" : upNext ? "Up next" : "Queued"}</span>
                    )}
                    <button
                      className="tick"
                      onClick={(e) => (e.stopPropagation(), completeTrack(t.id))}
                      aria-label={t.state === "done" ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
                      aria-pressed={t.state === "done"}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="tile c5">
            <h4>Subjects · % ready</h4>
            <div className="subj">
              {subjects.map((s) => (
                <button
                  key={s.name}
                  className="subj-row"
                  onClick={() => {
                    const t = tracks.find((x) => x.subject === s.name && x.state === "open");
                    if (t) makeCurrent(t.id);
                    else setView("subjects");
                  }}
                  title="Start this subject's next session"
                >
                  <span>{s.name}</span>
                  <b>{Math.round(ready(s) * 100)}%</b>
                  <span className="bar">
                    <i style={{ width: `${Math.round(ready(s) * 100)}%` }} />
                  </span>
                  <small>Exam in {s.examIn} days</small>
                </button>
              ))}
            </div>
          </div>

          <div className="tile c4">
            <div className="tile-head">
              <h4>This week · hours</h4>
              <span className="tile-note">{(((WEEK[day] / 100) * 5) + (day === (((now?.getDay() ?? 4) + 6) % 7) ? doneMin / 60 - 0.75 : 0)).toFixed(1)} h on {DAYS[day]}</span>
            </div>
            <div className="week">
              {WEEK.map((h, i) => (
                <button key={DAYS[i]} className={i === day ? "today" : undefined} onClick={() => setDay(i)} aria-label={`${DAYS[i]}: ${((h / 100) * 5).toFixed(1)} hours`} aria-pressed={i === day}>
                  <span className="col">
                    <i style={{ height: `${h}%` }} />
                  </span>
                  <span>{DAYS[i]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="tile c5">
            <h4>Deadlines</h4>
            <table className="dl">
              <tbody>
                {deadlines.map((d, i) => (
                  <tr key={d.name}>
                    <td>{d.name}</td>
                    <td className="muted">{dateIn(d.inDays)}</td>
                    <td>
                      <span className={`pill ${d.pr[1]}`}>{d.pr[0]}</span>
                    </td>
                    <td>
                      <button
                        className={`pill pill-btn ${STATUS[d.status].cls}`}
                        onClick={() => setDeadlines(deadlines.map((x, j) => (j === i ? { ...x, status: (x.status + 1) % 3 } : x)))}
                        aria-label={`${d.name}: ${STATUS[d.status].label}. Click to change status`}
                      >
                        {STATUS[d.status].label}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="tile tip c3 tile-btn" onClick={() => setTip((tip + 1) % TIPS.length)} aria-label="Next tip">
            <h4>Tip of the day</h4>
            <p key={tip} className="fade-up">
              {TIPS[tip]}
            </p>
            <small>
              Based on your confidence and exam dates · {tip + 1}/{TIPS.length}
            </small>
          </button>
        </div>
      )}

      {view === "subjects" && (
        <div className="dash demo-view" key="subjects" style={lock}>
          {subjects.map((s, i) => (
            <div key={s.name} className="tile c6">
              <div className="tile-head">
                <h4>{s.name}</h4>
                <span className="tile-note">Exam {dateIn(s.examIn)}</span>
              </div>
              <div className="subj">
                <div>
                  <span>Ready</span>
                  <b>{Math.round(ready(s) * 100)}%</b>
                  <span className="bar">
                    <i style={{ width: `${Math.round(ready(s) * 100)}%` }} />
                  </span>
                  <small>
                    {hm(s.doneMin)} done of {hm(needMin(s))} recommended
                  </small>
                </div>
              </div>
              <div className="demo-controls">
                <span className="tile-note">Confidence</span>
                <div className="chips">
                  {[1, 2, 3, 4, 5].map((c) => (
                    <button key={c} aria-pressed={s.confidence === c} onClick={() => setSubjects(subjects.map((x, j) => (j === i ? { ...x, confidence: c } : x)))}>
                      {c}
                    </button>
                  ))}
                </div>
                <button className="btn btn-ghost" onClick={() => setSubjects(subjects.map((x, j) => (j === i ? { ...x, doneMin: x.doneMin + 50 } : x)))}>
                  + Log a 50 min session
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "timetable" && (
        <div className="dash demo-view" key="timetable" style={lock}>
          <div className="tile c12">
            <div className="tile-head">
              <h4>This week</h4>
              <span className="tile-note">Tap a session to tick it off</span>
            </div>
            <div className="mini-grid" role="grid">
              <span />
              {DAYS.slice(0, 5).map((d) => (
                <span key={d} className="mini-day">
                  {d}
                </span>
              ))}
              {TIMETABLE.map((row) => (
                <div key={row.time} style={{ display: "contents" }}>
                  <span className="mini-time">{row.time}</span>
                  {row.cells.map((c, j) => {
                    const key = `${row.time}-${j}`;
                    const done = cellsDone.has(key);
                    return c ? (
                      <button
                        key={key}
                        className={`mini-cell ${c.startsWith("Revision") ? "rev" : ""} ${done ? "done" : ""}`}
                        aria-pressed={done}
                        onClick={() => {
                          const n = new Set(cellsDone);
                          if (done) n.delete(key);
                          else n.add(key);
                          setCellsDone(n);
                        }}
                      >
                        {done && "✓ "}
                        {c}
                      </button>
                    ) : (
                      <span key={key} className="mini-cell empty">
                        Free
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "insights" && (
        <div className="dash demo-view" key="insights" style={lock}>
          <div className="tile stat c4">
            <h4>Study streak</h4>
            <span className="n">6 days</span>
            <span className="d">Longest this semester</span>
          </div>
          <div className="tile stat c4">
            <h4>Sessions finished</h4>
            <span className="n">{Math.round(81 + (doneMin - 45) / 10)}%</span>
            <span className="d">of planned, last 7 days</span>
          </div>
          <div className="tile c4">
            <h4>Burnout risk</h4>
            <span className="pill p-ok" style={{ alignSelf: "flex-start" }}>
              Low
            </span>
            <small style={{ color: "var(--muted)", fontSize: 13 }}>Saturday is heavy (5 h). Aevia suggests halving it.</small>
          </div>
          <div className="tile c12">
            <h4>Chance you&apos;re exam-ready</h4>
            <div className="subj">
              {subjects.map((s) => {
                const pReady = Math.round(Math.min(0.97, Math.max(0.05, ready(s) * 1.1 - 0.05)) * 100);
                return (
                  <div key={s.name}>
                    <span>{s.name}</span>
                    <b>{pReady}%</b>
                    <span className="bar">
                      <i style={{ width: `${pReady}%` }} />
                    </span>
                    <small>From 1,000 simulated fortnights at your real pace</small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === "ai" && (
        <div className="dash demo-view" key="ai" style={lock}>
          <div className="tile c6">
            <h4>Plan my day</h4>
            <div className="chips" style={{ marginTop: 0 }}>
              {[1, 2, 3].map((h) => (
                <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>
                  I have {h} hour{h > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <div className="ans" key={hours}>
              {PLAN_MY_DAY[hours].map(([a, b]) => (
                <div key={a} className="row fade-up">
                  <span>{a}</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="tile c6">
            <h4>Butterfly effect</h4>
            <button className="ask ask-btn" onClick={() => setSkipped(!skipped)} aria-pressed={skipped}>
              {skipped ? "Undo: keep today" : "Skip today"}
            </button>
            {skipped ? (
              <div className="delta fade-up">
                <div>
                  <b>
                    <s>59% →</s> 55%
                  </b>
                  <small>Exam readiness</small>
                </div>
                <div>
                  <b>{hm(plannedMin - doneMin)}</b>
                  <small>Study time lost</small>
                </div>
                <div>
                  <b>+25 min</b>
                  <small>Extra per day to recover</small>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Tap to see what skipping today would cost, before you decide.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
