"use client";

import { ArrowRight, Check, Clock, Hourglass, Lightbulb, MessageSquareQuote, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FutureSelfResult } from "@/lib/ai";
import { WHAT_IF_PRESETS, type Planner, type WhatIf } from "@/lib/usePlanner";
import { Bar, ErrorNote, fmtDate, fmtMin, Modal, pct, Spinner, useAsync } from "./ui";
import { KIND_LABEL } from "./WeekGrid";

export type ToolId = "day" | "butterfly" | "teach" | "why";

const TOOLS: { id: ToolId; title: string; hint: string; icon: typeof Clock; tone: string }[] = [
  { id: "day", title: "Plan my day", hint: "Tell it your free hours", icon: Clock, tone: "#3b2a1e" },
  { id: "butterfly", title: "Butterfly effect", hint: "See the cost before you skip", icon: Hourglass, tone: "#4a2d22" },
  { id: "teach", title: "Teach it back", hint: "Explain it, find your gaps", icon: MessageSquareQuote, tone: "#353a28" },
  { id: "why", title: "Why this plan?", hint: "The reasoning, explained", icon: Lightbulb, tone: "#3a3024" },
];

export function ToolCards({ onOpen }: { onOpen: (t: ToolId) => void }) {
  return (
    <section id="tools" className="scroll-mt-6">
      <h2 className="section-title mb-3">Study tools</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TOOLS.map(({ id, title, hint, icon: Icon, tone }) => (
          <button
            key={id}
            onClick={() => onOpen(id)}
            className="group flex items-start gap-3 rounded-md border border-line p-3 text-left transition-colors hover:border-copper-2"
            style={{ background: `linear-gradient(160deg, ${tone}, #1d1712)` }}
          >
            <Icon size={22} className="mt-0.5 shrink-0 text-gold" />
            <span>
              <span className="block font-display text-lg leading-tight font-bold">{title}</span>
              <span className="text-sm text-ink-2">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------- Plan my day ----------------

const nextQuarter = () => {
  const d = new Date();
  const m = Math.ceil((d.getHours() * 60 + d.getMinutes() + 5) / 15) * 15;
  return m >= 24 * 60 ? "21:00" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function PlanMyDayModal({ p, onClose }: { p: Planner; onClose: () => void }) {
  const [hours, setHours] = useState(p.input.dayOverrides[p.today] ?? 2);
  const [start, setStart] = useState(p.input.dayStartOverrides?.[p.today] ?? nextQuarter());
  const [applied, setApplied] = useState(p.today in p.input.dayOverrides);
  const today = p.plan.sessions.filter((s) => s.date === p.today);
  const subj = (id: string) => p.input.subjects.find((s) => s.id === id);

  const apply = (h: number) => {
    setHours(h);
    p.planMyDay(h, start);
    setApplied(true);
  };

  const energy = p.input.dayEnergy?.[p.today] ?? "normal";
  return (
    <Modal open onClose={onClose} title="Plan my day" subtitle="How much free time do you have today? Your day is rebuilt around it, and the rest of the week adjusts.">
      <div className="mb-4">
        <span className="mb-1 block text-sm text-ink-2">How&apos;s your energy right now?</span>
        <div className="flex gap-1.5">
          {(
            [
              ["low", "Low: ease me in"],
              ["normal", "Normal"],
              ["high", "High: hardest first"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => p.setDayEnergy(id)} className={`btn py-1.5 ${energy === id ? "btn-primary" : "btn-ghost"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-sm text-ink-2">Free time</span>
          <div className="flex flex-wrap gap-1.5">
            {[0.5, 1, 2, 3, 4, 6].map((h) => (
              <button key={h} onClick={() => apply(h)} className={`btn py-1.5 ${applied && hours === h ? "btn-primary" : "btn-ghost"}`}>
                {h < 1 ? "30 min" : `${h}h`}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="mb-1 block text-sm text-ink-2">Custom hours</span>
          <input type="number" min={0.25} max={14} step={0.25} className="field w-24" value={hours} onChange={(e) => setHours(+e.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-sm text-ink-2">Starting at</span>
          <input type="time" className="field w-32" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <button className="btn btn-primary" onClick={() => apply(hours)} disabled={!(hours > 0)}>
          <Sparkles size={16} /> Plan it
        </button>
      </div>

      {applied && (
        <div className="fade-up mt-5">
          <h3 className="mb-2 font-display text-xl font-bold">
            Your plan for today <span className="text-base font-normal text-muted">· {fmtMin(today.reduce((a, s) => a + s.minutes, 0))} of focused study</span>
          </h3>
          {today.length ? (
            <ol className="space-y-1.5">
              {today.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded border border-line bg-panel-2 px-3 py-2">
                  <span className="w-24 shrink-0 text-sm text-gold tabular-nums">
                    {s.start}–{s.end}
                  </span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: subj(s.subjectId)?.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.title}</span>
                    <span className="text-sm text-muted">
                      {subj(s.subjectId)?.name} · {KIND_LABEL[s.kind]} · {s.minutes} min
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">That&apos;s not enough time for a focused session. Even 30 minutes gets you one.</p>
          )}
          <p className="mt-3 text-sm text-muted">
            Breaks of {p.input.prefs.breakMinutes} min sit between sessions. The most urgent work goes first: deadlines closest to today, weakest subjects, highest priority.
          </p>
          <button
            className="mt-2 text-sm text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink"
            onClick={() => {
              p.setInput((prev) => {
                const dayOverrides = { ...prev.dayOverrides };
                const dayStartOverrides = { ...prev.dayStartOverrides };
                delete dayOverrides[p.today];
                delete dayStartOverrides[p.today];
                return { ...prev, dayOverrides, dayStartOverrides };
              });
              setApplied(false);
            }}
          >
            Go back to my usual hours for today
          </button>
        </div>
      )}
    </Modal>
  );
}

// ---------------- Butterfly effect ----------------

const VERDICT = {
  go_ahead: { label: "Go ahead", className: "bg-olive/45 text-[#c3d0a2]" },
  think_twice: { label: "Think twice", className: "bg-ochre/45 text-[#e6c07e]" },
  dont: { label: "Don't", className: "bg-rust/50 text-[#f0b8a4]" },
};

export function ButterflyModal({ p, onClose }: { p: Planner; onClose: () => void }) {
  const [whatIf, setWhatIf] = useState<WhatIf | null>(null);
  const [text, setText] = useState("");
  const sim = useAsync(p.simulateText);
  const future = useAsync<FutureSelfResult, [WhatIf]>(p.askFutureSelf);
  const { run: runFuture, setData: setFuture } = future;

  useEffect(() => {
    setFuture(null);
    if (whatIf) runFuture(whatIf);
  }, [whatIf, runFuture, setFuture]);

  const d = whatIf?.diff;
  const drop = d ? d.overall.before - d.overall.after : 0;

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title="Butterfly effect"
      subtitle="See what a change costs your future before you make it. Nothing changes until you commit."
    >
      <div className="flex flex-wrap gap-2">
        {WHAT_IF_PRESETS.map((pr) => (
          <button key={pr.id} className="btn btn-ghost py-1.5" onClick={() => setWhatIf(p.simulatePreset(pr.id))}>
            {pr.label}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const w = await sim.run(text.trim());
          if (w) setWhatIf(w);
        }}
      >
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="What if I… go to the fest on Friday and skip Saturday too?" />
        <button className="btn btn-primary shrink-0" disabled={sim.loading || !text.trim()}>
          {sim.loading ? <Spinner /> : <Sparkles size={16} />} Simulate
        </button>
      </form>
      <ErrorNote error={sim.error} />

      {whatIf && d && (
        <div key={whatIf.scenario} className="fade-up mt-5 space-y-4">
          <div className="rounded-md border border-line bg-panel-2 p-4">
            <p className="text-sm text-muted">Scenario</p>
            <p className="font-display text-xl font-bold">{whatIf.scenario}</p>
            {whatIf.aiReply && <p className="mt-1 text-sm text-ink-2">{whatIf.aiReply}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Exam readiness" value={`${pct(d.overall.before)} → ${pct(d.overall.after)}`} bad={drop > 0.005} />
              <Stat label="Study time lost" value={d.lostMinutes > 0 ? fmtMin(d.lostMinutes) : "none"} bad={d.lostMinutes > 0} />
              <Stat
                label="To win it back"
                value={d.recovery ? `+${d.recovery.minutesPerDay} min/day` : "nothing needed"}
                sub={d.recovery ? `for the next ${d.recovery.days} days` : undefined}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">Readiness by subject</h3>
              <ul className="space-y-2.5">
                {d.subjects.map((s) => (
                  <li key={s.subjectId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className={`tabular-nums ${s.after < s.before - 0.005 ? "text-[#f0b8a4]" : "text-muted"}`}>
                        {pct(s.before)} → {pct(s.after)}
                      </span>
                    </div>
                    <div className="relative">
                      <Bar value={s.before} color="#5a4636" />
                      <div className="absolute inset-0">
                        <Bar value={s.after} color={s.after < s.before - 0.005 ? "#c0694c" : "#d9b27c"} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {!!d.heavierDays.length && (
                <div className="mt-4">
                  <h3 className="mb-1 font-display text-lg font-bold">Days that get heavier</h3>
                  {d.heavierDays.map((h) => (
                    <p key={h.date} className="text-sm text-ink-2">
                      {fmtDate(h.date)}: {fmtMin(h.beforeMin)} → <span className="text-gold">{fmtMin(h.afterMin)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-copper/60 bg-copper/15 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">A note from Future You</h3>
                {future.data && <span className={`chip ${VERDICT[future.data.verdict].className}`}>{VERDICT[future.data.verdict].label}</span>}
              </div>
              {future.loading && (
                <div className="space-y-2">
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4 w-5/6" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              )}
              {future.data && !future.loading && <p className="note">&ldquo;{future.data.message}&rdquo;</p>}
              {future.error && <p className="text-sm text-muted">Future You is unreachable right now ({future.error}). The numbers on the left are exact.</p>}
            </div>
          </div>

          {!!d.newWarnings.length && (
            <ul className="space-y-1">
              {d.newWarnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-[#e6c07e]">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn btn-ghost" onClick={() => setWhatIf(null)}>
              <X size={16} /> Discard
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                p.commitWhatIf(whatIf);
                onClose();
              }}
            >
              <Check size={16} /> Commit this change
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${bad ? "text-[#f0b8a4]" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ---------------- Teach it back ----------------

export function TeachBackModal({ p, init, onClose }: { p: Planner; init?: { subjectId: string; topic: string }; onClose: () => void }) {
  const [subjectId, setSubjectId] = useState(init?.subjectId ?? p.input.subjects[0]?.id ?? "");
  const [topic, setTopic] = useState(init?.topic ?? "");
  const [text, setText] = useState("");
  const tb = useAsync(p.teachBack);
  const subject = p.input.subjects.find((s) => s.id === subjectId);
  const r = tb.data;
  const scoreColor = r ? (r.score >= 75 ? "#9fb07a" : r.score >= 50 ? "#d9b27c" : "#d0775a") : "#d9b27c";

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title="Teach it back"
      subtitle="Explain a topic in your own words, like you're teaching a friend. The AI finds where your understanding breaks, and your plan adapts."
    >
      {!r && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length > 20) tb.run(subjectId, topic, text.trim());
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label>
              <span className="mb-1 block text-sm text-ink-2">Subject</span>
              <select className="field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {p.input.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm text-ink-2">Topic</span>
              <input className="field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Normalization" />
            </label>
          </div>
          {!!subject?.topics.length && (
            <div className="flex flex-wrap gap-1.5">
              {subject.topics.map((t) => (
                <button type="button" key={t} onClick={() => setTopic(t)} className={`chip ${topic === t ? "bg-copper/60 text-ink" : "bg-panel-3 text-ink-2 hover:text-ink"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="field min-h-40 text-[1.05rem]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Normalization is when we split tables so that… (write at least a few sentences)"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{text.trim().split(/\s+/).filter(Boolean).length} words</span>
            <button className="btn btn-primary" disabled={tb.loading || text.trim().length <= 20 || !topic.trim()}>
              {tb.loading ? <Spinner label="Reading your explanation…" /> : "Check my understanding"}
            </button>
          </div>
          <ErrorNote error={tb.error} />
        </form>
      )}

      {r && (
        <div className="fade-up space-y-4">
          <div className="flex items-center gap-5">
            <div
              className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${scoreColor} ${r.score * 3.6}deg, #30261d 0)` }}
            >
              <div className="flex size-[80px] flex-col items-center justify-center rounded-full bg-panel">
                <span className="font-display text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
                  {r.score}
                </span>
                <span className="text-[0.7rem] text-muted">understanding</span>
              </div>
            </div>
            <div>
              <p className="font-display text-xl font-bold">{r.verdict}</p>
              <p className="mt-1 rounded bg-olive/25 px-2 py-1 text-sm text-[#c3d0a2]">
                Plan updated: {subject?.name} confidence{" "}
                {r.confidenceBefore === r.confidenceAfter ? `stays at ${r.confidenceAfter}/5` : `${r.confidenceBefore} → ${r.confidenceAfter}/5`}
                {r.score < 70 ? `, and "${topic}" moves to the front of your next sessions.` : "."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 font-display text-lg font-bold">What you&apos;ve got</h3>
              <ul className="space-y-1">
                {r.solid.map((s) => (
                  <li key={s} className="flex gap-2 text-ink-2">
                    <Check size={16} className="mt-1 shrink-0 text-sage" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1.5 font-display text-lg font-bold">Where it breaks</h3>
              <ul className="space-y-1.5">
                {r.gaps.map((g) => (
                  <li key={g.concept} className="text-ink-2">
                    <span className="text-[#e8a58c]">{g.concept}:</span> {g.why}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {r.misconception && (
            <p className="flex gap-2 rounded border border-rust/60 bg-rust/15 px-3 py-2 text-[#f0b8a4]">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" /> <span><b>Misconception:</b> {r.misconception}</span>
            </p>
          )}
          <div className="rounded-md border border-line bg-panel-2 p-4">
            <h3 className="mb-1 font-display text-lg font-bold">Micro-lesson</h3>
            <p className="text-ink-2">{r.microLesson}</p>
            <p className="mt-3 text-gold">
              <ArrowRight size={15} className="mr-1 inline" />
              Now try: {r.followUpQuestion}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                tb.setData(null);
                setText("");
              }}
            >
              Explain again
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------- Why this plan ----------------

const RISK = {
  low: { label: "Low burnout risk", className: "bg-olive/45 text-[#c3d0a2]" },
  medium: { label: "Medium burnout risk", className: "bg-ochre/45 text-[#e6c07e]" },
  high: { label: "High burnout risk", className: "bg-rust/50 text-[#f0b8a4]" },
};

export function InsightsModal({ p, onClose }: { p: Planner; onClose: () => void }) {
  const ex = useAsync(p.explain);
  const { run } = ex;
  const data = p.insights;
  useEffect(() => {
    if (!data) run();
  }, [data, run]);
  const planned = p.plan.sessions.reduce((a, s) => a + s.minutes, 0);

  return (
    <Modal open onClose={onClose} width="max-w-3xl" title="Why this plan?" subtitle="The scheduling engine decides; the AI explains its reasoning in plain language.">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-line bg-panel-2 p-3">
          <p className="text-sm text-muted">Planned until {fmtDate(p.plan.endDate, "d MMM")}</p>
          <p className="font-display text-2xl font-bold">{fmtMin(planned)}</p>
        </div>
        <div className="rounded border border-line bg-panel-2 p-3">
          <p className="text-sm text-muted">Free buffer</p>
          <p className="font-display text-2xl font-bold">{fmtMin(p.plan.bufferMinutes)}</p>
        </div>
        <div className="rounded border border-line bg-panel-2 p-3">
          <p className="text-sm text-muted">Alerts</p>
          <p className="font-display text-2xl font-bold">{p.plan.warnings.length}</p>
        </div>
      </div>
      {ex.loading && !data && (
        <div className="space-y-2">
          <Spinner label="Reading your plan…" />
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4" />
          <div className="skeleton h-4 w-5/6" />
        </div>
      )}
      <ErrorNote error={ex.error} />
      {data && (
        <div className="fade-up space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-2xl font-bold">{data.headline}</p>
            <span className={`chip ${RISK[data.risk].className}`}>{RISK[data.risk].label}</span>
          </div>
          <ul className="space-y-1.5">
            {data.whyThisPlan.map((w) => (
              <li key={w} className="flex gap-2 text-ink-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" /> {w}
              </li>
            ))}
          </ul>
          <p className="rounded border border-copper/60 bg-copper/15 px-3 py-2">
            <span className="text-gold">Focus today: </span>
            {data.focusToday}
          </p>
          <p className="text-sm text-muted">{data.riskReason}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.subjectTips.map((t) => (
              <div key={t.subjectName} className="rounded border border-line bg-panel-2 px-3 py-2">
                <p className="font-display font-bold">{t.subjectName}</p>
                <p className="text-sm text-ink-2">{t.tip}</p>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => run()} disabled={ex.loading}>
            {ex.loading ? <Spinner /> : <Sparkles size={16} />} Refresh
          </button>
        </div>
      )}
    </Modal>
  );
}
