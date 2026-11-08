// PATCH /api/saved/:id { catalogId } — moves a saved item into a catalog (null = unsorted).
// PATCH /api/saved/:id { conversation } — replaces an Ask conversation with its latest version.
// DELETE /api/saved/:id — deletes a saved item.
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { cleanConversation } from "@/lib/conversation";
import { isUuid, ownsCatalog } from "@/lib/catalogs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  if (body && "conversation" in body) {
    const conversation = cleanConversation(body.conversation);
    if (!conversation) return Response.json({ error: "conversation needs at least one question and answer" }, { status: 400 });
    const rows = await db`
      UPDATE saved_responses
      SET conversation = ${db.json(conversation)}, response = ${conversation[0].answer}
      WHERE id = ${id} AND user_id = ${userId} AND mode = 'ask'
      RETURNING id
    `;
    if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ id, turns: conversation.length });
  }

  const catalogId = body?.catalogId ?? null;
  if (catalogId !== null && (!isUuid(catalogId) || !(await ownsCatalog(userId, catalogId)))) {
    return Response.json({ error: "Unknown catalog" }, { status: 400 });
  }

  const rows = await db`
    UPDATE saved_responses SET catalog_id = ${catalogId} WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ id, catalogId });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await db`DELETE FROM saved_responses WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
