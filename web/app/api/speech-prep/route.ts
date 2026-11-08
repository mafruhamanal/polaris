// POST /api/speech-prep — how to read some text aloud, as edits to it.
// Body: { text } → { edits: [{ start, end, spoken }] }
// Replace text[start, end) (UTF-16 units, like Swift's NSString) with `spoken` before sending it to a
// voice; "" means skip it (URLs, citation numbers). Abbreviations, money, units and so on are spelled out.
// Text with nothing to fix never reaches the AI. On any AI problem the cheap edits still come back.
import { getUserId } from "@/lib/getUserId";
import { prepareSpeech } from "@/lib/ai/prepareSpeech";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return Response.json({ error: "text is required" }, { status: 400 });

  const { edits } = await prepareSpeech(text);
  return Response.json({ edits });
}
