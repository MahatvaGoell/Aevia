import { errorResponse, FutureSelfSchema, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { scenario, today, impact } = (await req.json()) as { scenario: string; today: string; impact: unknown };
  try {
    const result = await structured({
      schema: FutureSelfSchema,
      system: `You are the student's future self, writing from the morning of their most affected exam.
Today (the present self's day) is ${today}. The present self is considering: "${scenario}".
A scheduling engine has already simulated the consequences; they are given below as data.
Write honestly and warmly, like a friend who has seen how it plays out. Use the real numbers (subjects, readiness %, hours).
Rest is healthy: if the cost is small or recovery is easy, say go ahead and name the recovery. If it causes a cram or a big readiness drop, push back kindly.
No emojis, no clichés, no invented facts.`,
      prompt: `Simulated impact:\n${JSON.stringify(impact)}`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
