import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

const CLAUDE_MODEL = "claude-opus-5";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

export class AIUnavailableError extends Error {}
export class AIHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Effort = "low" | "medium" | "high";

/**
 * One structured-output call: the model can only answer in the given schema.
 * Uses Groq when GROQ_API_KEY is set, otherwise Claude.
 */
export async function structured<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  effort?: Effort;
}): Promise<z.infer<T>> {
  if (process.env.GROQ_API_KEY) return groqStructured(opts);
  return claudeStructured(opts);
}

async function groqStructured<T extends z.ZodType>(opts: { system: string; prompt: string; schema: T; effort?: Effort }): Promise<z.infer<T>> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      reasoning_effort: opts.effort ?? "low",
      temperature: 0.4,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: z.toJSONSchema(opts.schema, { target: "draft-7" }) },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIHttpError(res.status, data?.error?.message ?? `Groq error ${res.status}`);
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("The AI returned an empty answer. Try again.");
  const parsed = opts.schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("The AI returned an unreadable answer. Try rephrasing.");
  return parsed.data as z.infer<T>;
}

async function claudeStructured<T extends z.ZodType>(opts: { system: string; prompt: string; schema: T; effort?: Effort }): Promise<z.infer<T>> {
  const c = getClient();
  if (!c) throw new AIUnavailableError("No AI key configured");

  const res = await c.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (!res.parsed_output) throw new Error("The AI returned an unreadable answer. Try rephrasing.");
  return res.parsed_output as z.infer<T>;
}

/** Explicit weekday -> date lookup so the model never has to do calendar arithmetic. */
export function calendarHint(today: string) {
  const base = new Date(`${today}T12:00:00`);
  const day = (i: number) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { name: d.toLocaleDateString("en-US", { weekday: "long" }), iso };
  };
  const thisWeek = Array.from({ length: 7 }, (_, i) => day(i))
    .map((d, i) => `${d.name}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""} = ${d.iso}`)
    .join("; ");
  const nextWeek = Array.from({ length: 7 }, (_, i) => day(i + 7))
    .map((d) => `next ${d.name} = ${d.iso}`)
    .join("; ");
  return `\nUpcoming days (use these exact dates, do not compute your own): ${thisWeek}.\nThe week after: ${nextWeek}.`;
}

export function errorResponse(err: unknown) {
  if (err instanceof AIUnavailableError) {
    return Response.json({ error: "AI is offline: add GROQ_API_KEY (or ANTHROPIC_API_KEY) to .env.local" }, { status: 503 });
  }
  if (err instanceof AIHttpError) {
    const msg = err.status === 429 ? "AI is busy (rate limited). Try again in a moment." : `AI error (${err.status}): ${err.message}`;
    return Response.json({ error: msg }, { status: err.status === 429 ? 429 : 502 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "AI is busy (rate limited). Try again in a moment." }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "AI key is invalid." }, { status: 401 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ error: `AI error (${err.status}): ${err.message}` }, { status: 502 });
  }
  return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
}

// ---------- schemas ----------

const level = z.number().int().describe("1 (low) to 5 (high)");

export const ParseSchema = z.object({
  studentName: z.string().nullable(),
  subjects: z.array(
    z.object({
      name: z.string(),
      priority: level,
      difficulty: level,
      confidence: level.describe("how prepared the student feels, 1 = not at all, 5 = very"),
      topics: z.array(z.string()).describe("syllabus topics, weakest first"),
    }),
  ),
  exams: z.array(z.object({ subjectName: z.string(), date: z.string().describe("YYYY-MM-DD"), title: z.string() })),
  assignments: z.array(
    z.object({
      subjectName: z.string(),
      title: z.string(),
      dueDate: z.string().describe("YYYY-MM-DD"),
      estimatedHours: z.number(),
    }),
  ),
  availability: z.object({
    weekdayHours: z.number().nullable(),
    weekendHours: z.number().nullable(),
    weekdayStart: z.string().nullable().describe("HH:mm, 24h"),
    weekendStart: z.string().nullable().describe("HH:mm, 24h"),
  }),
  blockedDates: z.array(z.object({ date: z.string().describe("YYYY-MM-DD"), reason: z.string() })),
  assumptions: z.string().describe("one or two short sentences on anything you had to assume"),
});
export type ParseResult = z.infer<typeof ParseSchema>;

export const OP_TYPES = [
  "block_day",
  "unblock_day",
  "set_day_hours",
  "set_weekday_hours",
  "set_weekend_hours",
  "update_subject",
  "move_exam",
  "add_exam",
  "add_assignment",
  "remove_assignment",
  "add_subject",
] as const;

export const AdjustSchema = z.object({
  reply: z.string().describe("1-2 friendly sentences telling the student what you changed and why"),
  operations: z.array(
    z.object({
      op: z.enum(OP_TYPES),
      date: z.string().nullable().describe("YYYY-MM-DD for day/exam ops"),
      hours: z.number().nullable(),
      subjectName: z.string().nullable(),
      priority: z.number().int().nullable(),
      difficulty: z.number().int().nullable(),
      confidence: z.number().int().nullable(),
      title: z.string().nullable(),
      estimatedHours: z.number().nullable(),
      reason: z.string().nullable(),
    }),
  ),
});
export type AdjustResult = z.infer<typeof AdjustSchema>;

export const InsightsSchema = z.object({
  headline: z.string().describe("max 12 words, encouraging and specific"),
  whyThisPlan: z.array(z.string()).describe("3-4 bullets explaining the plan's key decisions, each under 25 words"),
  focusToday: z.string().describe("one concrete sentence on what matters most today"),
  subjectTips: z.array(z.object({ subjectName: z.string(), tip: z.string().describe("one actionable study technique") })),
  risk: z.enum(["low", "medium", "high"]),
  riskReason: z.string(),
});
export type InsightsResult = z.infer<typeof InsightsSchema>;

export const FutureSelfSchema = z.object({
  message: z
    .string()
    .describe("2-3 sentences, first person, written by the student on their exam day to their present self"),
  verdict: z.enum(["go_ahead", "think_twice", "dont"]),
});
export type FutureSelfResult = z.infer<typeof FutureSelfSchema>;

export const TeachBackSchema = z.object({
  score: z.number().int().describe("0-100 depth of understanding shown by the explanation"),
  verdict: z.string().describe("one short sentence"),
  solid: z.array(z.string()).describe("ideas the student clearly understands (max 3)"),
  gaps: z
    .array(z.object({ concept: z.string(), why: z.string().describe("what is missing or shaky, one sentence") }))
    .describe("where understanding breaks down, most important first (max 3)"),
  misconception: z.string().nullable().describe("a factually wrong belief in the explanation, if any"),
  microLesson: z.string().describe("3-5 sentences that repair the biggest gap"),
  followUpQuestion: z.string().describe("one probing question to test the repaired understanding"),
  suggestedConfidence: z.number().int().describe("1-5: how prepared the student really is for this subject"),
});
export type TeachBackResult = z.infer<typeof TeachBackSchema>;

export const StudyKitSchema = z.object({
  steps: z.array(z.object({ minutes: z.number().int(), task: z.string() })).describe("minute-by-minute session plan"),
  flashcards: z.array(z.object({ q: z.string(), a: z.string() })).describe("4-6 cards"),
  practice: z.array(z.string()).describe("3 practice questions, exam style, increasing difficulty"),
  doneWhen: z.string().describe("one sentence: how the student knows the session succeeded"),
});
export type StudyKitResult = z.infer<typeof StudyKitSchema>;

// ---------- Labs ----------

export const PredictSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        topic: z.string(),
        likelihood: z.number().int().describe("0-100 chance this or a close variant appears"),
        marks: z.number().int().nullable(),
        why: z.string().describe("one short reason: syllabus weight, past-paper pattern, classic question"),
      }),
    )
    .describe("6-8 questions, most likely first"),
  topicWeights: z.array(z.object({ topic: z.string(), weight: z.number().int().describe("0-100, all weights sum to ~100") })),
  strategy: z.string().describe("2 sentences: how to split remaining prep time"),
});
export type PredictResult = z.infer<typeof PredictSchema>;

export const ConceptMapSchema = z.object({
  nodes: z.array(
    z.object({
      topic: z.string(),
      prerequisites: z.array(z.string()).describe("other topics in this list that must be understood first"),
      weak: z.boolean(),
      note: z.string().describe("one short line on what this topic needs from its prerequisites"),
    }),
  ),
  rootCauses: z
    .array(z.object({ topic: z.string(), explains: z.array(z.string()), why: z.string() }))
    .describe("weak foundations that cause weakness in later topics"),
  studyOrder: z.array(z.string()).describe("every topic, fix-roots-first order"),
});
export type ConceptMapResult = z.infer<typeof ConceptMapSchema>;

export const VivaSchema = z.object({
  feedbackOnLastAnswer: z.string().nullable(),
  lastAnswerQuality: z.enum(["none", "weak", "ok", "strong"]),
  nextQuestion: z.string().nullable().describe("null only when finished"),
  difficulty: z.number().int().describe("1-5 difficulty of nextQuestion"),
  finished: z.boolean(),
  report: z
    .object({
      score: z.number().int().describe("0-100"),
      strengths: z.array(z.string()),
      weakSpots: z.array(z.string()),
      suggestedConfidence: z.number().int().describe("1-5"),
      nextStep: z.string(),
    })
    .nullable(),
});
export type VivaResult = z.infer<typeof VivaSchema>;

export const ConceptPackSchema = z.object({
  explainerScript: z.string().describe("a 2-minute spoken explainer script, simple words, one idea per sentence"),
  analogy: z.string(),
  qa: z.array(z.object({ q: z.string(), a: z.string() })).describe("4 exam-style Q&A"),
  problems: z.array(z.object({ problem: z.string(), difficulty: z.enum(["easy", "medium", "hard"]), hint: z.string() })).describe("3 problems"),
  flashcards: z.array(z.object({ q: z.string(), a: z.string() })).describe("5 cards"),
  checklist: z.array(z.string()).describe("what a complete explanation of this topic must cover"),
});
export type ConceptPackResult = z.infer<typeof ConceptPackSchema>;

export const TwistQuestionsSchema = z.object({
  questions: z
    .array(z.object({ context: z.string().describe("an unfamiliar real-world setting"), question: z.string(), skill: z.string() }))
    .describe("exactly 3 questions that force applying the concept outside its textbook context"),
});
export type TwistQuestionsResult = z.infer<typeof TwistQuestionsSchema>;

export const TwistGradeSchema = z.object({
  results: z.array(
    z.object({
      score: z.number().int().describe("0-10"),
      transfer: z.enum(["none", "partial", "full"]).describe("did they carry the concept into the new context"),
      feedback: z.string(),
      modelAnswer: z.string(),
    }),
  ),
  overall: z.number().int().describe("0-100 fluency"),
  summary: z.string(),
  suggestedConfidence: z.number().int().describe("1-5"),
});
export type TwistGradeResult = z.infer<typeof TwistGradeSchema>;
