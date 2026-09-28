import { ConceptMapSchema, errorResponse, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { subject, topics, weakTopics } = (await req.json()) as { subject: string; topics: string[]; weakTopics: string[] };
  try {
    const result = await structured({
      schema: ConceptMapSchema,
      effort: "medium",
      system: `You map how topics in a university subject depend on each other, to find root causes of weakness.
Use the student's topic list (you may add at most 3 missing foundational topics if they are essential, marked in the note as "added").
A root cause is a weak or missing foundation that explains weakness in later topics. The study order must fix roots before the topics they unlock.`,
      prompt: `Subject: ${subject}\nTopics: ${topics.join(", ")}\nTopics the student feels weak in: ${weakTopics.join(", ") || "none given"}`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
