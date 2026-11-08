// POST /api/ask — answer a question about the user's selected text (called by the Mac app).
// Body: { question, selection, before?, after?, pageTitle?, history? } → AskResult (see lib/ai/ask.ts).
import { ask } from "@/lib/ai/ask";
import { GeminiError } from "@/lib/ai/gemini";
import { getUserId } from "@/lib/getUserId";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.question !== "string" || !body.question.trim() ||
      typeof body?.selection !== "string" || !body.selection.trim()) {
    return Response.json({ error: "question and selection are required" }, { status: 400 });
  }

  try {
    return Response.json(await ask(body));
  } catch (e) {
    const message =
      e instanceof GeminiError ? e.message
      : e instanceof Error && e.name === "TimeoutError" ? "Gemini took too long to answer. Please try again."
      : "Something went wrong";
    return Response.json({ error: message }, { status: 502 });
  }
}
