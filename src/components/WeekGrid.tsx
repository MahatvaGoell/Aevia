"use client";

import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { Ban, Check, ChevronLeft, ChevronRight, GraduationCap, Layers, MessageSquareQuote, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { StudyKitResult } from "@/lib/ai";
import { fromISO, toISO } from "@/lib/scheduler";
import type { Planner } from "@/lib/usePlanner";
import type { Session, SessionKind } from "@/lib/types";
import { ErrorNote, fmtDate, Modal, Spinner, useAsync } from "./ui";

export const KIND_LABEL: Record<SessionKind, string> = {
  learn: "Learn",
  practice: "Practice",
  revision: "Revision",
  assignment: "Assignment",
  review: "Review",
};

export const topicOf = (s: Session) => s.title.replace(/^(Learn|Practice|Review):\s*/, "");

export function WeekGrid({ p, onOpenSession, hideTitle }: { p: Planner; onOpenSession: (s: Session) => void; hideTitle?: boolean }) {
  const [offset, setOffset] = useState(0);
  const weekKey = toISO(addWeeks(startOfWeek(fromISO(p.today), { weekStartsOn: 1 }), offset));
  const weekStart = fromISO(weekKey);
  const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)));

  const { byCell, hours } = (() => {
    const doneIds = new Set<string>();
    const all = [
      ...p.completed.filter((c) => days.includes(c.date)).map((c) => (doneIds.add(c.id), c as Session)),
      ...p.plan.sessions.filter((s) => days.includes(s.date)),
    ];
    const byCell = new Map<string, { s: Session; done: boolean }[]>();
    const hourSet = new Set<number>();
    for (const s of all) {
      const h = +s.start.slice(0, 2);
      hourSet.add(h);
      const k = `${s.date}|${h}`;
      byCell.set(k, [...(byCell.get(k) ?? []), { s, done: doneIds.has(s.id) }]);
    }
    // only hours that have sessions, so a 10:00 weekend and 17:00 weekdays don't leave empty rows between
    const hours = [...hourSet].sort((a, b) => a - b);
    return { byCell, hours };
  })();

  const examOn = (d: string) => p.input.exams.filter((e) => e.date === d);
  const blockedOn = (d: string) => p.input.blocked.find((b) => b.date === d);
  const subj = (id: string) => p.input.subjects.find((s) => s.id === id);

  return (
    <section id="planner" className="scroll-mt-6">
      <div className="mb-2 flex items-center gap-3">
        {hideTitle ? <span className="flex-1" /> : <h2 className="section-title flex-1">Weekly planner</h2>}
        <div className="flex items-center gap-1 text-sm text-ink-2">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous week" className="rounded p-1 hover:bg-panel-3">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setOffset(0)} className="min-w-36 rounded px-2 py-0.5 hover:bg-panel-3">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM")}
          </button>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next week" className="rounded p-1 hover:bg-panel-3">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-panel-2">
              <th className="w-14 border-b border-line" />
              {days.map((d) => {
                const isToday = d === p.today;
                const blocked = blockedOn(d);
                return (
                  <th key={d} className={`border-b border-l border-line px-1.5 py-1.5 align-top font-normal ${isToday ? "bg-copper/25" : ""}`}>
                    <div className={`font-display text-base font-bold ${isToday ? "text-gold" : "text-ink"}`}>
                      {format(fromISO(d), "EEE d")}
                      {isToday && <span className="ml-1 text-xs font-normal">today</span>}
                    </div>
                    {examOn(d).map((e) => (
                      <div key={e.id} className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-gold" title={e.title}>
                        <GraduationCap size={12} className="shrink-0" /> {subj(e.subjectId)?.name}
                      </div>
                    ))}
                    {blocked && (
                      <div className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-muted" title={blocked.reason}>
                        <Ban size={11} className="shrink-0" /> {blocked.reason}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <td className="border-t border-line px-1.5 py-1 text-right align-top text-xs text-muted tabular-nums">{String(h).padStart(2, "0")}:00</td>
                {days.map((d) => (
                  <td key={d} className={`h-14 border-t border-l border-line p-1 align-top ${d === p.today ? "bg-copper/10" : ""}`}>
                    {(byCell.get(`${d}|${h}`) ?? []).map(({ s, done }) => {
                      const sub = subj(s.subjectId);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onOpenSession(s)}
                          title={`${sub?.name}: ${s.title} (${s.start}–${s.end})`}
                          className={`mb-0.5 block w-full rounded-sm px-1.5 py-1 text-left leading-tight transition hover:brightness-125 ${done ? "opacity-45" : ""}`}
                          style={{ background: `color-mix(in srgb, ${sub?.color ?? "#C9A176"} 24%, #221f1b)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sub?.color ?? "#C9A176"} 35%, transparent)` }}
                        >
                          <span className="flex items-center gap-1 truncate text-[0.8rem] font-semibold text-ink">
                            {done && <Check size={12} className="shrink-0" />}
                            {sub?.name}
                          </span>
                          <span className="block truncate text-[0.75rem] text-ink/75">
                            {s.kind === "revision" ? "Revision" : s.kind === "assignment" ? s.title : `${KIND_LABEL[s.kind]} · ${topicOf(s)}`}
                          </span>
                        </button>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
            {!hours.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">
                  Nothing scheduled this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SessionModal({
  p,
  session,
  onClose,
  onTeachBack,
}: {
  p: Planner;
  session: Session;
  onClose: () => void;
  onTeachBack: (subjectId: string, topic: string) => void;
}) {
  const sub = p.input.subjects.find((s) => s.id === session.subjectId);
  const done = p.completed.some((c) => c.id === session.id);
  const canCheck = done || session.date === p.today;
  const kit = useAsync(p.studyKit);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  return (
    <Modal
      open
      onClose={onClose}
      title={session.title}
      subtitle={`${sub?.name} · ${fmtDate(session.date, "EEEE d MMM")} · ${session.start}–${session.end} · ${KIND_LABEL[session.kind]}`}
    >
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          disabled={!canCheck}
          title={canCheck ? "" : "You can check this off on the day"}
          onClick={() => {
            p.toggleDone(session);
            onClose();
          }}
        >
          {done ? <RotateCcw size={16} /> : <Check size={16} />} {done ? "Mark not done" : "Mark done"}
        </button>
        <button className="btn btn-ghost" onClick={() => kit.run(session)} disabled={kit.loading}>
          <Layers size={16} /> {kit.data ? "Regenerate study kit" : "Generate study kit"}
        </button>
        <button className="btn btn-ghost" onClick={() => onTeachBack(session.subjectId, topicOf(session))}>
          <MessageSquareQuote size={16} /> Teach it back
        </button>
      </div>
      {!canCheck && <p className="mt-2 text-sm text-muted">Future sessions can be checked off on the day. Missed ones roll forward automatically.</p>}

      {kit.loading && (
        <div className="mt-5 space-y-2">
          <Spinner label="Building a study kit for this session…" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      )}
      <ErrorNote error={kit.error} />
      {kit.data && !kit.loading && <StudyKit kit={kit.data} flipped={flipped} setFlipped={setFlipped} />}
    </Modal>
  );
}

function StudyKit({ kit, flipped, setFlipped }: { kit: StudyKitResult; flipped: Set<number>; setFlipped: (s: Set<number>) => void }) {
  return (
    <div className="fade-up mt-5 space-y-5">
      <div>
        <h3 className="mb-2 font-display text-lg font-bold">Minute by minute</h3>
        <ol className="space-y-1.5">
          {kit.steps.map((st, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-14 shrink-0 rounded bg-panel-3 px-1.5 py-0.5 text-center text-sm text-gold tabular-nums">{st.minutes} min</span>
              <span className="text-ink-2">{st.task}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="mb-2 font-display text-lg font-bold">
          Flashcards <span className="text-sm font-normal text-muted">tap to flip</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {kit.flashcards.map((c, i) => {
            const open = flipped.has(i);
            return (
              <button
                key={i}
                onClick={() => {
                  const n = new Set(flipped);
                  if (open) n.delete(i);
                  else n.add(i);
                  setFlipped(n);
                }}
                className={`min-h-20 rounded border px-3 py-2 text-left text-[0.95rem] transition-colors ${
                  open ? "border-olive bg-olive/20 text-ink" : "border-line bg-panel-2 text-ink-2 hover:bg-panel-3"
                }`}
              >
                <span className="mb-0.5 block text-xs text-muted">{open ? "Answer" : "Question"}</span>
                {open ? c.a : c.q}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-display text-lg font-bold">Practice questions</h3>
        <ol className="list-decimal space-y-1 pl-5 text-ink-2">
          {kit.practice.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </div>
      <p className="rounded border border-line bg-panel-2 px-3 py-2 text-sm">
        <span className="text-gold">Done when: </span>
        {kit.doneWhen}
      </p>
    </div>
  );
}
