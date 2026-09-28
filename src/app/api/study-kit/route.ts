import { errorResponse, structured, StudyKitSchema } from "@/lib/ai";

export async function POST(req: Request) {
  const { subject, topic, kind, minutes, confidence } = (await req.json()) as {
    subject: string;
    topic: string;
    kind: string;
    minutes: number;
    confidence: number;
  };
  try {
    const result = await structured({
      schema: StudyKitSchema,
      system: `You design a single focused study session for a university student.
Session type meanings: learn = first exposure, practice = solve problems, revision = consolidate before the exam, assignment = make progress on a deliverable, review = light upkeep.
Steps must add up to exactly the session length and use active recall, not rereading. Tailor depth to the student's confidence (1 = beginner, 5 = strong).`,
      prompt: `Subject: ${subject}\nSession: ${kind} — ${topic}\nLength: ${minutes} minutes\nConfidence: ${confidence}/5`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
