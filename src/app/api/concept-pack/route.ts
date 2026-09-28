import { ConceptPackSchema, errorResponse, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { subject, topic, confidence } = (await req.json()) as { subject: string; topic: string; confidence: number };
  try {
    const result = await structured({
      schema: ConceptPackSchema,
      effort: "medium",
      system: `You create a complete one-topic study pack for a university student, pitched at their confidence level (1 = beginner, 5 = strong).
Be accurate and exam-oriented. Problems should resemble university exam questions.`,
      prompt: `Subject: ${subject}\nTopic: ${topic}\nConfidence: ${confidence}/5`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
