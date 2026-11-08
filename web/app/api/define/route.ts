// POST /api/define — Word help on the Mac: what a word means in the sentence it's in.
// Body: { word, sentence } → { meaning }
import { define } from "@/lib/ai/define";
import { aiErrorResponse } from "@/lib/ai/gemini";
import { getUserId } from "@/lib/getUserId";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const word = typeof body?.word === "string" ? body.word.trim() : "";
  const sentence = typeof body?.sentence === "string" && body.sentence.trim() ? body.sentence : word;
  if (!word) return Response.json({ error: "word is required" }, { status: 400 });

  try {
    return Response.json({ meaning: await define(word, sentence) });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
