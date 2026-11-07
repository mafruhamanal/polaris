import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db`
    SELECT id, original_text, response, mode, source_app, source_url, source_window, created_at
    FROM saved_responses
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return Response.json(rows);
}
