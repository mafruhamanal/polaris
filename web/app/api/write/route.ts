// POST /api/write — the Mac's Write feature: turn a spoken transcript into a note.
// Body: { transcript, selection?, pageTitle? } → { title, note, catalog } (see lib/ai/write.ts).
import { write } from "@/lib/ai/write";
import { aiErrorResponse } from "@/lib/ai/gemini";
import { listCatalogs } from "@/lib/catalogs";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.transcript !== "string" || !body.transcript.trim()) {
    return Response.json({ error: "transcript is required" }, { status: 400 });
  }

  const [catalogs, level] = await Promise.all([
    listCatalogs(userId),
    db`SELECT reading_level FROM reader_settings WHERE user_id = ${userId}`,
  ]);

  try {
    return Response.json(await write({
      transcript: body.transcript,
      selection: typeof body.selection === "string" ? body.selection : null,
      pageTitle: typeof body.pageTitle === "string" ? body.pageTitle : null,
      catalogs: catalogs.map((c) => c.name),
      readingLevel: level[0]?.reading_level ?? null,
    }));
  } catch (e) {
    return aiErrorResponse(e);
  }
}
