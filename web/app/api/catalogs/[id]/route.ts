// PATCH /api/catalogs/:id { name } — renames a catalog.
// DELETE /api/catalogs/:id — deletes it; its items stay saved, just unsorted.
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { cleanCatalogName, isUuid } from "@/lib/catalogs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = cleanCatalogName(body?.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  try {
    const rows = await db`
      UPDATE catalogs SET name = ${name} WHERE id = ${id} AND user_id = ${userId} RETURNING id, name
    `;
    if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ id: String(rows[0].id), name: String(rows[0].name) });
  } catch {
    return Response.json({ error: "You already have a catalog with that name" }, { status: 409 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await db`DELETE FROM catalogs WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
