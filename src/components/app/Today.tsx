"use client";

import { addDays, startOfWeek } from "date-fns";
import { Info, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { MoonArt, Ring } from "@/components/aevia/Art";
import { fmtMin, useAsync } from "@/components/ui";
import { daysBetween, fromISO, toISO } from "@/lib/scheduler";
import type { Session } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { readiness } from "@/lib/whatif";

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const secondsUntil = (endAt: number) => Math.max(0, Math.round((endAt - Date.now()) / 1000));
const deadlineIn = (seconds: number) => Date.now() + seconds * 1000;
const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}

export function Today({ p, onOpenSession, onWhy }: { p: Planner; onOpenSession: (s: Session) => void; onWhy: () => void }) {
  const subj = (id: string) => p.input.subjects.find((s) => s.id === id);
  const planned = p.plan.sessions.filter((s) => s.date === p.today);
  const doneToday = p.completed.filter((c) => c.date === p.today);
  const plannedMin = planned.reduce((a, s) => a + s.minutes, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // hours studied this week vs last week
  const weekStart = startOfWeek(fromISO(p.today), { weekStartsOn: 1 });
  const inRange = (d: string, from: Date, days: number) => {
    const n = daysBetween(toISO(from), d);
    return n >= 0 && n < days;
  };
  const thisWeek = p.completed.filter((c) => inRange(c.date, weekStart, 7)).reduce((a, c) => a + c.minutes, 0);
  const lastWeek = p.completed.filter((c) => inRange(c.date, addDays(weekStart, -7), 7)).reduce((a, c) => a + c.minutes, 0);
  const delta = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const spark = Array.from({ length: 9 }, (_, i) => {
    const d = toISO(addDays(fromISO(p.today), i - 8));
    return p.completed.filter((c) => c.date === d).reduce((a, c) => a + c.minutes, 0);
  });
  const sparkMax = Math.max(60, ...spark);
  const pts = spark.map((m, i) => `${(i / 8) * 200} ${40 - (m / sparkMax) * 34}`);

  // overall readiness, weighted by how much prep each exam needs
  const examStats = p.plan.stats.filter((s) => s.nextExam);
  const totalT = examStats.reduce((a, s) => a + s.targetMinutes, 0);
  const overall = totalT ? examStats.reduce((a, s) => a + readiness(s) * s.targetMinutes, 0) / totalT : 0;
  const nextExam = [...p.input.exams].filter((e) => daysBetween(p.today, e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];

  // playlist + focus timer
  const current = planned[0];
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [trackId, setTrackId] = useState<string | null>(null);
  if ((current?.id ?? null) !== trackId) {
    setTrackId(current?.id ?? null);
    setRemaining((current?.minutes ?? 0) * 60);
    setRunning(false);
  }
  const { toggleDone } = p;
  useEffect(() => {
    if (!running || !current) return;
    const endAt = deadlineIn(remaining);
    const t = setInterval(() => {
      const left = secondsUntil(endAt);
      setRemaining(left);
      if (left === 0) {
        clearInterval(t);
        setRunning(false);
        beep();
        toggleDone(current);
      }
    }, 1000);
    return () => clearInterval(t);
    // restart only on play/pause or track change; `remaining` is the starting point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, current?.id]);

  const tracks = [...doneToday.map((s) => ({ s, state: "done" as const })), ...planned.map((s, i) => ({ s, state: i === 0 ? ("now" as const) : i === 1 ? ("next" as const) : ("queued" as const) }))].sort((a, b) =>
    a.s.start.localeCompare(b.s.start),
  );

  // week bars: planned + done minutes per day
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = toISO(addDays(weekStart, i));
    const m = [...p.plan.sessions, ...p.completed].filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0);
    return { d, m, label: DAY[fromISO(d).getDay()] };
  });
  const weekMax = Math.max(60, ...week.map((w) => w.m));

  // deadlines
  const rows = [
    ...p.input.assignments.map((a) => {
      const done = p.completed.filter((c) => c.assignmentId === a.id).reduce((m, c) => m + c.minutes, 0);
      const st = done >= a.estimatedHours * 57 ? ["Done", "p-ok"] : daysBetween(p.today, a.dueDate) < 0 ? ["Overdue", "p-hi"] : done ? ["In progress", "p-in"] : ["To do", "p-md"];
      return { key: a.id, name: a.title, date: a.dueDate, subjectId: a.subjectId, status: st };
    }),
    ...p.input.exams
      .filter((e) => daysBetween(p.today, e.date) >= 0)
      .map((e) => {
        const n = daysBetween(p.today, e.date);
        return { key: e.id, name: e.title, date: e.date, subjectId: e.subjectId, status: [n === 0 ? "Exam today" : `Exam in ${n}d`, n <= 3 ? "p-hi" : "p-in"] };
      }),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const tip =
    p.insights?.focusToday ??
    (() => {
      const weakest = [...p.input.subjects].filter((s) => p.plan.stats.find((x) => x.subjectId === s.id)?.nextExam).sort((a, b) => a.confidence - b.confidence)[0];
      const ws = weakest && p.plan.stats.find((x) => x.subjectId === weakest.id);
      if (weakest && ws?.daysLeft != null) return `${weakest.name} is your weakest subject (confidence ${weakest.confidence}/5) and the exam is in ${ws.daysLeft} days. Do it first, while you're fresh.`;
      return current ? `Start with ${subj(current.subjectId)?.name} at ${current.start}. Small steps every day add up.` : "Nothing left today. Rest well.";
    })();

  const [ask, setAsk] = useState("");
  const replan = useAsync(p.adjust);

  return (
    <div className="dash">
      <div className="tile hello c5">
        <div>
          <b>
            {greet}, {p.input.studentName || "there"}
          </b>
          <small>
            {planned.length + doneToday.length} sessions today · {fmtMin(plannedMin)} left
          </small>
        </div>
        <MoonArt id="moon-app" />
      </div>
      <div className="tile stat c4">
        <h4>Hours studied this week</h4>
        <span className="n">{(thisWeek / 60).toFixed(1)}</span>
        <span className="d" style={delta != null && delta < 0 ? { color: "var(--warn)" } : undefined}>
          {delta == null ? "First week with Aevia" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs last week`}
        </span>
        <svg viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sa-app" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C9A176" stopOpacity=".35" />
              <stop offset="1" stopColor="#C9A176" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M${pts.join(" L")} L200 46 L0 46Z`} fill="url(#sa-app)" />
          <path d={`M${pts.join(" L")}`} fill="none" stroke="#C9A176" strokeWidth="1.6" />
        </svg>
      </div>
      <div className="tile c3">
        <h4>Exam readiness</h4>
        <div className="readiness">
          <Ring value={overall} id="rg-app" />
          <p>{nextExam ? `Next: ${subj(nextExam.subjectId)?.name}, in ${daysBetween(p.today, nextExam.date)} days` : "No exams scheduled"}</p>
        </div>
      </div>

      <div className="tile play c7">
        <div className="row-head">
          <h4>Today&apos;s playlist</h4>
          {current && (
            <button className="linkish" style={{ fontSize: 13 }} onClick={() => toggleDone(current)}>
              Mark current done
            </button>
          )}
        </div>
        {tracks.map(({ s, state }) => {
          const sub = subj(s.subjectId);
          const exam = s.examId ? p.input.exams.find((e) => e.id === s.examId) : undefined;
          const meta = exam ? `exam in ${daysBetween(p.today, exam.date)} days` : s.assignmentId ? "assignment" : `confidence ${sub?.confidence}/5`;
          return (
            <div key={s.id} className={`track ${state === "done" ? "done" : state === "now" ? "now" : ""}`} onClick={() => onOpenSession(s)}>
              <time>{s.start}</time>
              <div>
                {sub?.name} · {s.title.replace(/^(Learn|Practice|Review):\s*/, "")}
                <em>
                  {s.minutes} min · {meta}
                </em>
              </div>
              {state === "now" ? (
                <button
                  className="chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRunning((r) => !r);
                  }}
                  aria-label={running ? "Pause focus timer" : "Start focus timer"}
                >
                  {running ? `❚❚ ${clock(remaining)} left` : `▶ ${clock(remaining)}`}
                </button>
              ) : (
                <span className="chip">{state === "done" ? "✓ Done" : state === "next" ? "Up next" : "Queued"}</span>
              )}
            </div>
          );
        })}
        {!tracks.length && <p style={{ color: "var(--muted)", fontSize: 14 }}>No sessions today. Enjoy the break, or use Plan my day in Coach.</p>}
      </div>
      <div className="tile c5">
        <h4>Subjects · % ready</h4>
        <div className="subj">
          {p.input.subjects.map((s) => {
            const st = p.plan.stats.find((x) => x.subjectId === s.id);
            const r = st ? readiness(st) : 0;
            return (
              <div key={s.id}>
                <span>{s.name}</span>
                <b>{Math.round(r * 100)}%</b>
                <span className="bar">
                  <i style={{ width: `${Math.round(r * 100)}%` }} />
                </span>
                <small>{st?.daysLeft != null ? `Exam in ${st.daysLeft} days` : "No exam scheduled"}</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tile c4">
        <h4>This week · hours</h4>
        <div className="week" aria-label="Study minutes per day this week">
          {week.map((w) => (
            <div key={w.d} className={w.d === p.today ? "today" : undefined} title={fmtMin(w.m)}>
              <span className="col">
                <i style={{ height: `${(w.m / weekMax) * 100}%` }} />
              </span>
              <span>{w.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tile c5">
        <h4>Deadlines</h4>
        {rows.length ? (
          <table className="dl">
            <tbody>
              {rows.map((r) => {
                const pr = subj(r.subjectId)?.priority ?? 3;
                return (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td className="muted">{fromISO(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                    <td>
                      <span className={`pill ${pr >= 4 ? "p-hi" : pr === 3 ? "p-md" : "p-ok"}`}>{pr >= 4 ? "High" : pr === 3 ? "Medium" : "Low"}</span>
                    </td>
                    <td>
                      <span className={`pill ${r.status[1]}`}>{r.status[0]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing due. Add exams and assignments in Subjects.</p>
        )}
      </div>
      <div className="tile tip c3">
        <h4>Tip of the day</h4>
        <p>{tip}</p>
        <small>
          Based on your confidence and exam dates ·{" "}
          <button className="linkish" onClick={onWhy}>
            Why this plan?
          </button>
        </small>
      </div>

      {!!p.plan.warnings.length && (
        <div className="c12" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {p.plan.warnings.map((w) => (
            <div key={w.message} className={`alert ${w.level === "info" ? "info" : ""}`}>
              {w.level === "info" ? <Info /> : <TriangleAlert style={{ color: "var(--warn)" }} />}
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="tile c12">
        <h4>Replan by chat</h4>
        <form
          className="askbar"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ask.trim()) return;
            if (await replan.run(ask.trim())) setAsk("");
          }}
        >
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="I'm sick on Thursday, and I can do 5 hours on Sunday" aria-label="Tell Aevia what changed" />
          <button className="btn" disabled={replan.loading || !ask.trim()}>
            {replan.loading ? "Replanning…" : "Replan"}
          </button>
        </form>
        {replan.error && <p style={{ color: "var(--warn)", fontSize: 14 }}>{replan.error}</p>}
        {replan.data && (
          <p className="note fade-up">
            {replan.data.reply}
            {!!replan.data.log.length && <span style={{ display: "block", fontStyle: "normal", color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Changed: {replan.data.log.join(" · ")}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
