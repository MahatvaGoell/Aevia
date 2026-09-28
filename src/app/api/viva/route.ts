import { errorResponse, structured, VivaSchema } from "@/lib/ai";

const MAX_QUESTIONS = 5;

export async function POST(req: Request) {
  const { subject, topics, history } = (await req.json()) as {
    subject: string;
    topics: string[];
    history: { role: "examiner" | "student"; text: string }[];
  };
  const asked = history.filter((h) => h.role === "examiner").length;
  try {
    const result = await structured({
      schema: VivaSchema,
      effort: "medium",
      system: `You are a fair but probing university viva (oral exam) examiner for ${subject}.
Topics: ${topics.join(", ") || "standard syllabus"}.
Rules:
- Ask ONE question at a time. Start at difficulty 2-3.
- After each answer: give one or two sentences of feedback, then adapt. Strong answer -> harder question or a deeper "why". Vague or partly wrong answer -> a clarifying follow-up on the same idea before moving on, like a real examiner.
- You have asked ${asked} of ${MAX_QUESTIONS} questions. When ${MAX_QUESTIONS} questions have been answered, set finished = true, nextQuestion = null, and write the report. Otherwise report = null.
- Report: score 0-100, concrete strengths and weak spots (name the exact concept), suggestedConfidence 1-5, one next step.`,
      prompt: history.length
        ? `Transcript so far:\n${history.map((h) => `${h.role.toUpperCase()}: ${h.text}`).join("\n")}`
        : "Begin the viva with your first question. lastAnswerQuality = none.",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
