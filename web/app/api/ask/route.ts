// POST /api/ask — answer a question about the user's selected text (called by the Mac app).
// Body: { question, selection, before?, after?, pageTitle?, history?, image? } → AskResult (see lib/ai/ask.ts).
// `image` is a base64 JPEG screenshot; then `selection` is the text recognized from it (may be empty).
import { ask } from "@/lib/ai/ask";
import { aiErrorResponse, imageFrom } from "@/lib/ai/gemini";
import { getUserId } from "@/lib/getUserId";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const image = imageFrom(body?.image);
  const selection = typeof body?.selection === "string" ? body.selection : "";
  if (typeof body?.question !== "string" || !body.question.trim() || (!selection.trim() && !image)) {
    return Response.json({ error: "question and selection (or image) are required" }, { status: 400 });
  }

  try {
    return Response.json(await ask({ ...body, selection, image }));
  } catch (e) {
    return aiErrorResponse(e);
  }
}
