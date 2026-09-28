"use client";

import {
  Activity,
  Check,
  Copy,
  GitBranch,
  LineChart,
  Mic,
  Package,
  Send,
  Shuffle,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type {
  ConceptMapResult,
  ConceptPackResult,
  PredictResult,
  TwistGradeResult,
  TwistQuestionsResult,
  VivaResult,
} from "@/lib/ai";
import {
  decodeBuddy,
  encodeBuddy,
  forecast,
  matchBuddy,
  momentum,
  sampleBuddy,
  toBuddyProfile,
  type BuddyMatch,
  type BuddyProfile,
} from "@/lib/analytics";
import { daysBetween } from "@/lib/scheduler";
import { callAI, type Planner } from "@/lib/usePlanner";
import { Bar, ErrorNote, fmtDate, fmtMin, Modal, pct, Spinner, useAsync } from "./ui";

export type LabId = "predict" | "map" | "viva" | "pack" | "twist" | "momentum" | "forecast" | "buddy";

const LABS: { id: LabId; title: string; hint: string; icon: typeof Target }[] = [
  { id: "predict", title: "Exam predictor", hint: "Likely questions & topic weightage", icon: Target },
  { id: "map", title: "Concept map", hint: "Find the root cause of weak topics", icon: GitBranch },
  { id: "viva", title: "Viva simulator", hint: "Adaptive oral exam with follow-ups", icon: Mic },
  { id: "pack", title: "Concept pack", hint: "Script, Q&A, problems, flashcards", icon: Package },
  { id: "twist", title: "Twist test", hint: "Apply it somewhere unexpected", icon: Shuffle },
  { id: "momentum", title: "Momentum", hint: "Streaks, pace & burnout radar", icon: Activity },
  { id: "forecast", title: "Readiness forecast", hint: "Your odds of being exam-ready", icon: LineChart },
  { id: "buddy", title: "Study buddy", hint: "Match strengths with a friend", icon: Users },
];

export function LabCards({ onOpen, only }: { onOpen: (id: LabId) => void; only?: LabId[] }) {
  return (
    <div className="tools">
      {LABS.filter((l) => !only || only.includes(l.id)).map(({ id, title, hint, icon: Icon }) => (
        <article key={id} className="tool">
          <div className="tool-top">
            <h3>{title}</h3>
            <Icon size={22} style={{ color: "var(--bronze)" }} />
          </div>
          <p>{hint}</p>
          <button className="btn btn-ghost" onClick={() => onOpen(id)}>
            Open {title.toLowerCase()}
          </button>
        </article>
      ))}
    </div>
  );
}

export function LabModal({ id, p, onClose }: { id: LabId; p: Planner; onClose: () => void }) {
  const lab = LABS.find((l) => l.id === id)!;
  const Body = { predict: Predictor, map: ConceptMap, viva: Viva, pack: ConceptPack, twist: TwistTest, momentum: MomentumView, forecast: ForecastView, buddy: Buddy }[id];
  return (
    <Modal open onClose={onClose} title={lab.title} subtitle={lab.hint} width="max-w-3xl">
      <Body p={p} />
    </Modal>
  );
}

// ---------- shared bits ----------

function useSubjectPick(p: Planner) {
  const nearest = [...p.input.exams].filter((e) => daysBetween(p.today, e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  const [subjectId, setSubjectId] = useState(nearest?.subjectId ?? p.input.subjects[0]?.id ?? "");
  const subject = p.input.subjects.find((s) => s.id === subjectId);
  return { subjectId, setSubjectId, subject };
}

function SubjectSelect({ p, value, onChange }: { p: Planner; value: string; onChange: (id: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-2">Subject</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {p.input.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TopicInput({ topics, value, onChange }: { topics: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">Topic</span>
        <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Deadlocks" />
      </label>
      {!!topics.length && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <button key={t} type="button" onClick={() => onChange(t)} className={`chip before:hidden ${value === t ? "bg-copper/60 text-ink" : "bg-panel-3 text-ink-2 hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mt-4 mb-1.5 font-display text-lg font-bold">{children}</h3>;
const Done = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 flex items-center gap-2 rounded bg-olive/25 px-3 py-1.5 text-sm text-[#c3d0a2]">
    <Check size={15} /> {children}
  </p>
);

// ---------- 1. Exam predictor ----------

function Predictor({ p }: { p: Planner }) {
  const { subjectId, setSubjectId, subject } = useSubjectPick(p);
  const [papers, setPapers] = useState("");
  const [applied, setApplied] = useState(false);
  const exam = p.input.exams.find((e) => e.subjectId === subjectId);
  const req = useAsync((body: object) => callAI<PredictResult>("/api/predict", body));
  const r = req.data;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <SubjectSelect p={p} value={subjectId} onChange={(v) => (setSubjectId(v), req.setData(null), setApplied(false))} />
        <label className="block">
          <span className="mb-1 block text-sm text-ink-2">Past papers or notes (optional, improves the prediction)</span>
          <textarea className="field min-h-20" value={papers} onChange={(e) => setPapers(e.target.value)} placeholder="Paste last year's questions, or what the professor emphasised…" />
        </label>
      </div>
      <button
        className="btn btn-primary mt-3"
        disabled={req.loading || !subject}
        onClick={() =>
          req.run({
            subject: subject!.name,
            topics: subject!.topics,
            examTitle: exam?.title ?? `${subject!.name} exam`,
            daysLeft: exam ? daysBetween(p.today, exam.date) : null,
            pastPapers: papers,
          })
        }
      >
        {req.loading ? <Spinner label="Reading the syllabus like an examiner…" /> : "Predict my exam"}
      </button>
      <ErrorNote error={req.error} />
      {r && (
        <div className="fade-up">
          <H>Most likely questions</H>
          <ol className="space-y-2">
            {r.questions.map((q, i) => (
              <li key={i} className="rounded border border-line bg-panel-2 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <span>{q.question}</span>
                  <span className="shrink-0 font-display text-xl font-bold text-gold tabular-nums">{q.likelihood}%</span>
                </div>
                <p className="text-sm text-muted">
                  {q.topic}
                  {q.marks ? ` · ~${q.marks} marks` : ""} · {q.why}
                </p>
              </li>
            ))}
          </ol>
          <H>Topic weightage</H>
          <div className="space-y-1.5">
            {[...r.topicWeights].sort((a, b) => b.weight - a.weight).map((t) => (
              <div key={t.topic} className="grid grid-cols-[180px_1fr_44px] items-center gap-2 text-sm">
                <span className="truncate text-ink-2">{t.topic}</span>
                <Bar value={t.weight / 100} color="#d9b27c" />
                <span className="text-right tabular-nums">{t.weight}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-ink-2">{r.strategy}</p>
          {applied ? (
            <Done>Your next {subject?.name} sessions now follow this weightage.</Done>
          ) : (
            <button
              className="btn btn-ghost mt-3"
              onClick={() => {
                p.setTopicOrder(subjectId, [...r.topicWeights].sort((a, b) => b.weight - a.weight).map((t) => t.topic));
                setApplied(true);
              }}
            >
              Prioritise my sessions by this weightage
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 2. Concept map ----------

function ConceptMap({ p }: { p: Planner }) {
  const { subjectId, setSubjectId, subject } = useSubjectPick(p);
  const [weak, setWeak] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);
  const req = useAsync((body: object) => callAI<ConceptMapResult>("/api/concept-map", body));
  const r = req.data;
  const roots = new Set(r?.rootCauses.map((x) => x.topic.toLowerCase()));
  return (
    <div>
      <SubjectSelect p={p} value={subjectId} onChange={(v) => (setSubjectId(v), setWeak(new Set()), req.setData(null), setApplied(false))} />
      <p className="mt-3 mb-1.5 text-sm text-ink-2">Which topics feel weak?</p>
      <div className="flex flex-wrap gap-1.5">
        {subject?.topics.map((t) => {
          const on = weak.has(t);
          return (
            <button
              key={t}
              onClick={() => {
                const n = new Set(weak);
                if (on) n.delete(t);
                else n.add(t);
                setWeak(n);
              }}
              className={`chip before:hidden ${on ? "bg-rust/50 text-ink" : "bg-panel-3 text-ink-2"}`}
            >
              {t}
            </button>
          );
        })}
        {!subject?.topics.length && <span className="text-sm text-muted">Add topics to this subject first (click its card).</span>}
      </div>
      <button className="btn btn-primary mt-3" disabled={req.loading || !subject?.topics.length} onClick={() => req.run({ subject: subject!.name, topics: subject!.topics, weakTopics: [...weak] })}>
        {req.loading ? <Spinner label="Tracing dependencies…" /> : "Build my concept map"}
      </button>
      <ErrorNote error={req.error} />
      {r && (
        <div className="fade-up">
          {!!r.rootCauses.length && (
            <>
              <H>Root causes</H>
              {r.rootCauses.map((c) => (
                <div key={c.topic} className="mb-2 rounded border border-rust/60 bg-rust/15 px-3 py-2">
                  <p className="font-bold text-[#f0b8a4]">{c.topic}</p>
                  <p className="text-sm text-ink-2">
                    Explains trouble with: {c.explains.join(", ")}. {c.why}
                  </p>
                </div>
              ))}
            </>
          )}
          <H>How the topics connect</H>
          <ul className="space-y-1">
            {r.nodes.map((n) => (
              <li key={n.topic} className="flex flex-wrap items-baseline gap-x-2 border-b border-line/70 py-1.5">
                <span className={`font-bold ${roots.has(n.topic.toLowerCase()) ? "text-[#f0b8a4]" : n.weak ? "text-gold" : "text-ink"}`}>{n.topic}</span>
                {!!n.prerequisites.length && <span className="text-sm text-muted">needs {n.prerequisites.join(" + ")}</span>}
                <span className="w-full text-sm text-ink-2">{n.note}</span>
              </li>
            ))}
          </ul>
          <H>Fix-first study order</H>
          <ol className="list-decimal space-y-0.5 pl-5 text-ink-2">
            {r.studyOrder.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          {applied ? (
            <Done>Your sessions now follow this order.</Done>
          ) : (
            <button className="btn btn-ghost mt-3" onClick={() => (p.setTopicOrder(subjectId, r.studyOrder), setApplied(true))}>
              Use this order in my plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 3. Viva simulator ----------

type Turn = { role: "examiner" | "student"; text: string; quality?: VivaResult["lastAnswerQuality"] };

function Viva({ p }: { p: Planner }) {
  const { subjectId, setSubjectId, subject } = useSubjectPick(p);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState<VivaResult["report"]>(null);
  const [update, setUpdate] = useState<{ before: number; after: number } | null>(null);
  const [difficulty, setDifficulty] = useState(2);
  const bottom = useRef<HTMLDivElement>(null);
  const req = useAsync((history: Turn[]) =>
    callAI<VivaResult>("/api/viva", { subject: subject?.name, topics: subject?.topics ?? [], history: history.map(({ role, text }) => ({ role, text })) }),
  );

  const step = async (history: Turn[]) => {
    const r = await req.run(history);
    if (!r) return;
    const examiner = [r.feedbackOnLastAnswer, r.nextQuestion].filter(Boolean).join("\n\n");
    setTurns([...history.slice(0, -1), ...(history.length ? [{ ...history.at(-1)!, quality: r.lastAnswerQuality }] : []), { role: "examiner", text: examiner || "That's the end of the viva." }]);
    setDifficulty(r.difficulty);
    if (r.finished && r.report) setReport(r.report);
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const asked = turns.filter((t) => t.role === "examiner").length;
  const Q = { weak: "text-[#f0b8a4]", ok: "text-[#e6c07e]", strong: "text-[#c3d0a2]", none: "" };

  if (!turns.length)
    return (
      <div>
        <SubjectSelect p={p} value={subjectId} onChange={setSubjectId} />
        <p className="mt-3 text-ink-2">
          Five questions from an examiner who adapts: answer well and it digs deeper; answer vaguely and it asks a follow-up, like a real viva. You get a report at the end.
        </p>
        <button className="btn btn-primary mt-3" disabled={req.loading || !subject} onClick={() => step([])}>
          {req.loading ? <Spinner label="The examiner is ready…" /> : "Start the viva"}
        </button>
        <ErrorNote error={req.error} />
      </div>
    );

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        {subject?.name} · question {Math.min(asked, 5)} of 5 · difficulty {difficulty}/5
      </p>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {turns.map((t, i) => (
          <div key={i} className={`rounded px-3 py-2 whitespace-pre-line ${t.role === "examiner" ? "border border-line bg-panel-2" : "ml-10 bg-copper/25"}`}>
            <p className="mb-0.5 text-xs text-muted">
              {t.role === "examiner" ? "Examiner" : "You"}
              {t.quality && t.quality !== "none" && <span className={`ml-2 ${Q[t.quality]}`}>· {t.quality} answer</span>}
            </p>
            {t.text}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {!report ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!answer.trim()) return;
            const history = [...turns, { role: "student" as const, text: answer.trim() }];
            setTurns(history);
            setAnswer("");
            step(history);
          }}
        >
          <textarea className="field min-h-16" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" disabled={req.loading} />
          <button className="btn btn-primary shrink-0 self-end" disabled={req.loading || !answer.trim()}>
            {req.loading ? <Spinner /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <div className="fade-up mt-4 rounded-md border border-copper/60 bg-copper/15 p-4">
          <p className="font-display text-2xl font-bold">Viva score: {report.score}/100</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted">Strengths</p>
              <ul className="text-ink-2">
                {report.strengths.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm text-muted">Weak spots</p>
              <ul className="text-[#f0b8a4]">
                {report.weakSpots.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 text-ink-2">Next step: {report.nextStep}</p>
          {update ? (
            <Done>
              {subject?.name} confidence {update.before} → {update.after}/5. Weak spots moved to the front of your sessions.
            </Done>
          ) : (
            <button
              className="btn btn-primary mt-3"
              onClick={() => {
                setUpdate(p.blendConfidence(subjectId, report.suggestedConfidence));
                p.setTopicOrder(subjectId, report.weakSpots.filter((w) => subject?.topics.some((t) => t.toLowerCase() === w.toLowerCase())));
              }}
            >
              Update my plan from this viva
            </button>
          )}
        </div>
      )}
      <ErrorNote error={req.error} />
    </div>
  );
}

// ---------- 4. Concept pack ----------

function ConceptPack({ p }: { p: Planner }) {
  const { subjectId, setSubjectId, subject } = useSubjectPick(p);
  const [topic, setTopic] = useState(subject?.topics[0] ?? "");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const req = useAsync((body: object) => callAI<ConceptPackResult>("/api/concept-pack", body));
  const r = req.data;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <SubjectSelect p={p} value={subjectId} onChange={(v) => (setSubjectId(v), setTopic(""))} />
        <TopicInput topics={subject?.topics ?? []} value={topic} onChange={setTopic} />
      </div>
      <button
        className="btn btn-primary mt-3"
        disabled={req.loading || !topic.trim() || !subject}
        onClick={() => (setFlipped(new Set()), req.run({ subject: subject!.name, topic, confidence: subject!.confidence }))}
      >
        {req.loading ? <Spinner label="Packing everything about this topic…" /> : "Build concept pack"}
      </button>
      <ErrorNote error={req.error} />
      {r && (
        <div className="fade-up">
          <H>2-minute explainer script</H>
          <p className="rounded border border-line bg-panel-2 px-3 py-2 whitespace-pre-line text-ink-2">{r.explainerScript}</p>
          <p className="mt-2 text-ink-2">
            <span className="text-gold">Analogy: </span>
            {r.analogy}
          </p>
          <H>Exam Q&A</H>
          {r.qa.map((x) => (
            <details key={x.q} className="mb-1.5 rounded border border-line bg-panel-2 px-3 py-2">
              <summary className="cursor-pointer">{x.q}</summary>
              <p className="mt-1 text-ink-2">{x.a}</p>
            </details>
          ))}
          <H>Practice problems</H>
          {r.problems.map((x) => (
            <details key={x.problem} className="mb-1.5 rounded border border-line bg-panel-2 px-3 py-2">
              <summary className="cursor-pointer">
                <span className="chip mr-2 bg-panel-3 text-ink-2 before:hidden">{x.difficulty}</span>
                {x.problem}
              </summary>
              <p className="mt-1 text-sm text-muted">Hint: {x.hint}</p>
            </details>
          ))}
          <H>Flashcards</H>
          <div className="grid gap-2 sm:grid-cols-2">
            {r.flashcards.map((c, i) => {
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
                  className={`min-h-16 rounded border px-3 py-2 text-left ${open ? "border-olive bg-olive/20" : "border-line bg-panel-2 text-ink-2"}`}
                >
                  {open ? c.a : c.q}
                </button>
              );
            })}
          </div>
          <H>A complete explanation covers</H>
          <ul className="space-y-0.5">
            {r.checklist.map((c) => (
              <li key={c} className="flex gap-2 text-ink-2">
                <Check size={15} className="mt-1 shrink-0 text-sage" /> {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- 5. Twist test ----------

function TwistTest({ p }: { p: Planner }) {
  const { subjectId, setSubjectId, subject } = useSubjectPick(p);
  const [topic, setTopic] = useState(subject?.topics[0] ?? "");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [update, setUpdate] = useState<{ before: number; after: number } | null>(null);
  const gen = useAsync((body: object) => callAI<TwistQuestionsResult>("/api/twist", { mode: "generate", ...body }));
  const grade = useAsync((body: object) => callAI<TwistGradeResult>("/api/twist", { mode: "grade", ...body }));
  const qs = gen.data?.questions ?? [];
  const g = grade.data;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <SubjectSelect p={p} value={subjectId} onChange={(v) => (setSubjectId(v), setTopic(""))} />
        <TopicInput topics={subject?.topics ?? []} value={topic} onChange={setTopic} />
      </div>
      <button
        className="btn btn-primary mt-3"
        disabled={gen.loading || !topic.trim() || !subject}
        onClick={() => (grade.setData(null), setUpdate(null), setAnswers(["", "", ""]), gen.run({ subject: subject!.name, topic }))}
      >
        {gen.loading ? <Spinner label="Hiding the concept somewhere unexpected…" /> : qs.length ? "New twist questions" : "Give me twist questions"}
      </button>
      <ErrorNote error={gen.error} />
      {!!qs.length && (
        <div className="fade-up mt-4 space-y-3">
          {qs.map((q, i) => (
            <div key={i} className="rounded border border-line bg-panel-2 p-3">
              <p className="text-sm text-gold">{q.context}</p>
              <p className="mb-2">{q.question}</p>
              <textarea
                className="field min-h-16"
                value={answers[i]}
                onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                placeholder="Your approach…"
              />
              {g?.results[i] && (
                <div className="mt-2 text-sm">
                  <p>
                    <b className="text-gold">{g.results[i].score}/10</b> · transfer: {g.results[i].transfer} · {g.results[i].feedback}
                  </p>
                  <details className="mt-1 text-ink-2">
                    <summary className="cursor-pointer text-muted">Model answer</summary>
                    {g.results[i].modelAnswer}
                  </details>
                </div>
              )}
            </div>
          ))}
          {!g && (
            <button
              className="btn btn-primary"
              disabled={grade.loading || answers.every((a) => !a.trim())}
              onClick={() => grade.run({ subject: subject!.name, topic, questions: qs, answers })}
            >
              {grade.loading ? <Spinner label="Grading your reasoning…" /> : "Grade my fluency"}
            </button>
          )}
          <ErrorNote error={grade.error} />
          {g && (
            <div className="rounded-md border border-copper/60 bg-copper/15 p-4">
              <p className="font-display text-2xl font-bold">Fluency: {g.overall}/100</p>
              <p className="text-ink-2">{g.summary}</p>
              {update ? (
                <Done>
                  {subject?.name} confidence {update.before} → {update.after}/5
                </Done>
              ) : (
                <button className="btn btn-ghost mt-2" onClick={() => setUpdate(p.blendConfidence(subjectId, g.suggestedConfidence))}>
                  Update my plan
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 6. Momentum ----------

export function MomentumView({ p }: { p: Planner }) {
  const m = useMemo(() => momentum(p.input, p.plan, p.completed, p.plannedLog, p.today), [p.input, p.plan, p.completed, p.plannedLog, p.today]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const RISK = { low: "bg-olive/45 text-[#c3d0a2]", medium: "bg-ochre/45 text-[#e6c07e]", high: "bg-rust/50 text-[#f0b8a4]" };
  const max = Math.max(60, ...m.days.map((d) => d.planned));
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Streak" value={`${m.streak} day${m.streak === 1 ? "" : "s"}`} />
        <Tile label="Sessions finished" value={m.completionRate == null ? "n/a" : pct(m.completionRate)} />
        <Tile label="Trend" value={m.trend ?? "n/a"} />
        <div className="rounded border border-line bg-panel-2 p-3">
          <p className="text-sm text-muted">Burnout risk</p>
          <span className={`chip mt-1 ${RISK[m.risk]}`}>{m.risk}</span>
        </div>
      </div>
      <H>Last 7 days: planned vs done</H>
      {m.hasHistory ? (
        <div className="flex h-32 items-end gap-2">
          {m.days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex h-24 w-full items-end justify-center">
                <div className="absolute bottom-0 w-full rounded-t bg-panel-3" style={{ height: `${(d.planned / max) * 100}%` }} />
                <div className="relative w-full rounded-t bg-gold/80" style={{ height: `${(d.done / max) * 100}%` }} title={`${fmtMin(d.done)} of ${fmtMin(d.planned)}`} />
              </div>
              <span className="text-xs text-muted">{fmtDate(d.date, "EEE")}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">Not enough history yet. Check off sessions for a few days (or load the demo student) and your momentum shows up here.</p>
      )}
      {!!m.reasons.length && (
        <>
          <H>What the radar sees</H>
          <ul className="space-y-1">
            {m.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-ink-2">
                <TriangleAlert size={15} className="mt-1 shrink-0 text-ochre" /> {r}
              </li>
            ))}
          </ul>
        </>
      )}
      {!!m.suggestions.length && (
        <>
          <H>Suggestions</H>
          <div className="space-y-2">
            {m.suggestions.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded border border-line bg-panel-2 px-3 py-2">
                <div className="flex-1">
                  <p className="font-bold">{s.label}</p>
                  <p className="text-sm text-ink-2">{s.detail}</p>
                </div>
                {s.action.type !== "none" &&
                  (applied.has(s.label) ? (
                    <span className="text-sm text-sage">Applied</span>
                  ) : (
                    <button className="btn btn-ghost shrink-0" onClick={() => (p.applyMomentumAction(s.action), setApplied(new Set(applied).add(s.label)))}>
                      Apply
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel-2 p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-bold capitalize">{value}</p>
    </div>
  );
}

// ---------- 7. Readiness forecast ----------

export function ForecastView({ p }: { p: Planner }) {
  const m = useMemo(() => momentum(p.input, p.plan, p.completed, p.plannedLog, p.today), [p.input, p.plan, p.completed, p.plannedLog, p.today]);
  const [rate, setRate] = useState(() => Math.round((m.completionRate ?? 0.75) * 100));
  const rows = useMemo(() => forecast(p.input, p.plan, p.completed, p.today, rate / 100), [p.input, p.plan, p.completed, p.today, rate]);
  return (
    <div>
      <p className="text-ink-2">
        1,000 simulated futures per exam. Each one completes your planned sessions at your real pace, with good weeks and bad weeks. &ldquo;Ready&rdquo; means at least 80% of the recommended prep done.
      </p>
      <label className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-sm text-ink-2">Pace: I finish</span>
        <input type="range" min={30} max={100} value={rate} onChange={(e) => setRate(+e.target.value)} className="flex-1 accent-[#a8714c]" />
        <span className="w-44 shrink-0 text-sm tabular-nums">
          {rate}% of sessions {m.completionRate != null && Math.round(m.completionRate * 100) === rate ? "(your real pace)" : ""}
        </span>
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-[0.95rem]">
          <thead>
            <tr className="text-left text-sm text-ink-2">
              <th className="py-1 font-normal">Exam</th>
              <th className="py-1 font-normal">Likely readiness (10th–90th percentile)</th>
              <th className="py-1 text-right font-normal">Chance ready</th>
              <th className="py-1 text-right font-normal">+1h/day</th>
              <th className="py-1 text-right font-normal">−1h/day</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subjectId} className="border-t border-line">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </span>
                  <span className="text-xs text-muted">{fmtDate(r.exam, "d MMM")}</span>
                </td>
                <td className="py-2 pr-4">
                  <div className="relative h-2 rounded-full bg-black/30">
                    <div className="absolute h-2 rounded-full bg-copper/70" style={{ left: pct(Math.min(1, r.p10)), width: pct(Math.max(0.01, Math.min(1, r.p90) - Math.min(1, r.p10))) }} />
                    <div className="absolute -top-0.5 h-3 w-0.5 bg-gold" style={{ left: pct(Math.min(1, r.expected)) }} />
                    <div className="absolute -top-1 h-4 w-px bg-ink/50" style={{ left: "80%" }} title="80% = ready" />
                  </div>
                  <span className="text-xs text-muted">
                    {pct(Math.min(1, r.p10))}–{pct(Math.min(1, r.p90))} · {r.sessions} sessions left
                  </span>
                </td>
                <td className={`py-2 text-right font-display text-xl font-bold tabular-nums ${r.pReady >= 0.7 ? "text-[#c3d0a2]" : r.pReady >= 0.4 ? "text-gold" : "text-[#f0b8a4]"}`}>
                  {pct(r.pReady)}
                </td>
                <td className="py-2 text-right tabular-nums text-[#c3d0a2]">{pct(r.pReadyPlus)}</td>
                <td className="py-2 text-right tabular-nums text-[#f0b8a4]">{pct(r.pReadyMinus)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  Add exam dates to forecast readiness.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 8. Study buddy ----------

function Buddy({ p }: { p: Planner }) {
  const me = useMemo(() => toBuddyProfile(p.input), [p.input]);
  const myCode = useMemo(() => encodeBuddy(me), [me]);
  const [code, setCode] = useState("");
  const [them, setThem] = useState<BuddyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const match: BuddyMatch | null = them ? matchBuddy(me, them) : null;
  const MODE = {
    you_teach: (n: string) => `You teach ${n}`,
    they_teach: (n: string) => `${n} teaches you`,
    together: () => "Both shaky: study it together with Teach it back",
    both_strong: () => "Both strong: quiz each other",
  };
  const first = them?.name.split(" ")[0] ?? "";
  return (
    <div>
      <p className="text-ink-2">Share your code with a classmate and paste theirs. Nothing leaves this device; the code carries your subjects, confidence and free hours.</p>
      <H>Your buddy code</H>
      <div className="flex gap-2">
        <input readOnly className="field font-mono text-xs" value={myCode} onFocus={(e) => e.target.select()} />
        <button
          className="btn btn-ghost shrink-0"
          onClick={() => {
            navigator.clipboard?.writeText(myCode);
            setCopied(true);
          }}
        >
          <Copy size={15} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <H>Your friend&apos;s code</H>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const d = decodeBuddy(code);
          setError(d ? null : "That code doesn't look right. It should start with SS1-");
          setThem(d);
        }}
      >
        <input className="field font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SS1-…" />
        <button className="btn btn-primary shrink-0" disabled={!code.trim()}>
          Match
        </button>
      </form>
      <button className="mt-2 text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => (setThem(sampleBuddy(me)), setError(null))}>
        No code yet? Try with a sample classmate
      </button>
      <ErrorNote error={error} />
      {them && match && (
        <div className="fade-up mt-4 rounded-md border border-line bg-panel-2 p-4">
          <p className="font-display text-2xl font-bold">
            You + {them.name}: {match.score}% match
          </p>
          <div className="mt-2 space-y-1.5">
            {match.pairs.map((x) => (
              <div key={x.subject} className="grid grid-cols-[160px_1fr] gap-2">
                <span className="font-bold">{x.subject}</span>
                <span className="text-ink-2">
                  {MODE[x.mode](first)} <span className="text-sm text-muted">(you {x.mine}/5, {first} {x.theirs}/5)</span>
                </span>
              </div>
            ))}
            {!match.pairs.length && <p className="text-muted">No subjects in common.</p>}
          </div>
          <p className="mt-3 text-sm text-muted">Best times to meet</p>
          {match.slots.length ? (
            match.slots.map((s) => (
              <p key={s.day} className="text-ink-2">
                {s.day} {s.from}–{s.to} <span className="text-sm text-muted">({fmtMin(s.minutes)})</span>
              </p>
            ))
          ) : (
            <p className="text-ink-2">Your free hours don&apos;t overlap. Try a weekend.</p>
          )}
        </div>
      )}
    </div>
  );
}
