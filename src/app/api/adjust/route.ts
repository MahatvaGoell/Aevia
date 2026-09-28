import { AdjustSchema, calendarHint, errorResponse, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { request, today, context } = (await req.json()) as { request: string; today: string; context: unknown };
  try {
    const result = await structured({
      schema: AdjustSchema,
      effort: "medium",
      system: `You are the rescheduling assistant inside an AI study planner.
The student describes a change in their life or plan. You do NOT write the timetable: you emit operations that edit the planner's inputs, and a scheduling engine rebuilds the timetable from them.
Today is ${today}. ${calendarHint(today)}
Resolve relative dates to YYYY-MM-DD using that calendar ("Thursday" = the first Thursday on or after today).

Operations:
- block_day {date, reason}: student can't study that day (sick, event, travel)
- unblock_day {date}
- set_day_hours {date, hours}: one specific day
- set_weekday_hours {hours} / set_weekend_hours {hours}: recurring availability
- update_subject {subjectName, priority?, difficulty?, confidence?}: e.g. "I'm struggling with OS" -> lower confidence
- move_exam {subjectName, date}
- add_exam {subjectName, date, title}
- add_assignment {subjectName, title, date (due), estimatedHours}
- remove_assignment {title}
- add_subject {subjectName, priority, difficulty, confidence}
Leave unused fields null. Use subject names exactly as they appear in the current planner state.
If the request is unclear or needs no change, return no operations and ask a short clarifying question in reply.

Current planner state:
${JSON.stringify(context)}`,
      prompt: request,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
