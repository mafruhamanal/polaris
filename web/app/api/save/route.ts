import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

type SaveBody = {
  originalText: string;
  response: string;
  mode: string;
  sourceApp?: string;
  sourceUrl?: string;
  sourceWindow?: string;
};

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: SaveBody = await req.json();

  const rows = await db`
    INSERT INTO saved_responses (user_id, original_text, response, mode, source_app, source_url, source_window)
    VALUES (${userId}, ${body.originalText}, ${body.response}, ${body.mode}, ${body.sourceApp ?? null}, ${body.sourceUrl ?? null}, ${body.sourceWindow ?? null})
    RETURNING *
  `;

  return Response.json(rows[0], { status: 201 });
}
