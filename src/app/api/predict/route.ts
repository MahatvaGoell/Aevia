import { errorResponse, PredictSchema, structured } from "@/lib/ai";

export async function POST(req: Request) {
  const { subject, topics, examTitle, daysLeft, pastPapers } = (await req.json()) as {
    subject: string;
    topics: string[];
    examTitle: string;
    daysLeft: number | null;
    pastPapers: string;
  };
  try {
    const result = await structured({
      schema: PredictSchema,
      effort: "medium",
      system: `You are an experienced university examiner for Indian engineering programmes (mid-sem and end-sem papers).
Predict the questions most likely to appear on the student's exam. Use how examiners actually set papers: high-weight syllabus units, classic derivations and numericals, repeated past-paper patterns.
If past-paper text is given, weight repeated patterns heavily and say so in "why". Never claim certainty; likelihoods are estimates.`,
      prompt: `Subject: ${subject}\nExam: ${examTitle}${daysLeft != null ? ` (in ${daysLeft} days)` : ""}\nSyllabus topics: ${topics.join(", ") || "not given, infer the standard syllabus"}\n\nPast papers / notes from the student:\n${pastPapers || "(none)"}`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
