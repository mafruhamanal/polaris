// GET /api/catalogs — the user's catalogs with item counts.
// POST /api/catalogs { name } — creates one (or returns the existing one with that name).
import { getUserId } from "@/lib/getUserId";
import { cleanCatalogName, findOrCreateCatalog, listCatalogs } from "@/lib/catalogs";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ catalogs: await listCatalogs(userId) });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = cleanCatalogName(body?.name);
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  return Response.json(await findOrCreateCatalog(userId, name), { status: 201 });
}
