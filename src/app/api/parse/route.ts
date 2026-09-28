import { calendarHint, errorResponse, ParseSchema, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { text, today } = (await req.json()) as { text: string; today: string };
  try {
    const result = await structured({
      schema: ParseSchema,
      effort: "medium",
      system: `You turn a student's free-form description of their academic situation into structured planner data.
Today is ${today}. ${calendarHint(today)}
Resolve relative dates to YYYY-MM-DD using that calendar ("this Friday" = the first Friday on or after today; "15th" = the next 15th), never in the past.
Infer priority/difficulty/confidence (1-5) from what the student says; use 3 when there is no signal.
Words like "weak in", "scared of", "haven't started" mean low confidence. "Most important", "backlog", "failing" mean high priority.
List topics the student mentions, weakest first. Estimate assignment hours realistically if not given.
Only include availability fields the student actually states; otherwise null.`,
      prompt: text,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
