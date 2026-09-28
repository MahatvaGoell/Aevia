import { errorResponse, structured, TeachBackSchema } from "@/lib/ai";

export async function POST(req: Request) {
  const { subject, topic, explanation } = (await req.json()) as { subject: string; topic: string; explanation: string };
  try {
    const result = await structured({
      schema: TeachBackSchema,
      effort: "medium",
      system: `You are an examiner using the Feynman technique. A university student explains a topic in their own words.
Judge understanding, not grammar or length. Find exactly where the mental model breaks: missing steps, memorised-but-not-understood phrases, wrong causal links, edge cases they can't handle.
Be specific to what they wrote; quote their words when pointing at a gap. Be encouraging but honest. A vague or one-line explanation scores low.
suggestedConfidence: 1 = can't explain the basics, 3 = core idea right with gaps, 5 = could teach it.`,
      prompt: `Subject: ${subject}\nTopic: ${topic}\n\nStudent's explanation:\n"""${explanation}"""`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
