import { errorResponse, InsightsSchema, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { today, summary } = (await req.json()) as { today: string; summary: unknown };
  try {
    const result = await structured({
      schema: InsightsSchema,
      effort: "medium",
      system: `You are a supportive, practical study coach reviewing a timetable that a scheduling engine generated for a student.
Explain the plan's reasoning in plain language a stressed student will trust: why subjects are ordered this way, where the crunch points are, and what to protect.
Base every claim on the data given; never invent exams or numbers. Today is ${today}.`,
      prompt: `Plan summary:\n${JSON.stringify(summary)}`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
