import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { cleanCatalogName, findOrCreateCatalog, isUuid, ownsCatalog } from "@/lib/catalogs";

type SaveBody = {
  originalText: string;
  response: string;
  mode: string;
  sourceApp?: string;
  sourceUrl?: string;
  sourceWindow?: string;
  title?: string;
  /** File into this catalog... */
  catalogId?: string;
  /** ...or into the catalog with this name, created if needed. */
  catalogName?: string;
};

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: SaveBody = await req.json();

  let catalogId: string | null = null;
  if (body.catalogId) {
    if (!isUuid(body.catalogId) || !(await ownsCatalog(userId, body.catalogId))) {
      return Response.json({ error: "Unknown catalog" }, { status: 400 });
    }
    catalogId = body.catalogId;
  } else if (cleanCatalogName(body.catalogName)) {
    catalogId = (await findOrCreateCatalog(userId, cleanCatalogName(body.catalogName))).id;
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : null;

  const rows = await db`
    INSERT INTO saved_responses (user_id, original_text, response, mode, source_app, source_url, source_window, title, catalog_id)
    VALUES (${userId}, ${body.originalText}, ${body.response}, ${body.mode}, ${body.sourceApp ?? null}, ${body.sourceUrl ?? null}, ${body.sourceWindow ?? null}, ${title}, ${catalogId})
    RETURNING *
  `;

  return Response.json(rows[0], { status: 201 });
}
