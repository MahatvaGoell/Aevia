import { errorResponse, structured, TwistGradeSchema, TwistQuestionsSchema } from "@/lib/ai";

export async function POST(req: Request) {
  const body = (await req.json()) as
    | { mode: "generate"; subject: string; topic: string }
    | { mode: "grade"; subject: string; topic: string; questions: { context: string; question: string }[]; answers: string[] };
  try {
    if (body.mode === "generate") {
      const result = await structured({
        schema: TwistQuestionsSchema,
        system: `You test concept FLUENCY, not memory. Write questions that drop a university concept into an unfamiliar, concrete setting (a food-delivery app, a cricket scoreboard, a hospital queue...) so the student must recognise and apply it. No definitions, no "explain X" questions.`,
        prompt: `Subject: ${body.subject}\nConcept: ${body.topic}`,
      });
      return Response.json(result);
    }
    const result = await structured({
      schema: TwistGradeSchema,
      effort: "medium",
      system: `You grade concept-transfer answers. Reward recognising which concept applies and using it correctly in the new setting; reward elegant, minimal reasoning over long text. Blank or off-topic answers score 0.`,
      prompt: `Subject: ${body.subject}\nConcept: ${body.topic}\n\n${body.questions
        .map((q, i) => `Q${i + 1} [${q.context}] ${q.question}\nStudent answer: ${body.answers[i] || "(blank)"}`)
        .join("\n\n")}`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
