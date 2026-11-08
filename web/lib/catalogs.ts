// Catalogs: named folders a user groups saved responses (and Write notes) into.
import { db } from "@/lib/db";

export type Catalog = { id: string; name: string; count: number };

export const MAX_CATALOG_NAME = 60;

/** Trims and caps a catalog name; "" if nothing usable is left. */
export function cleanCatalogName(name: unknown): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, MAX_CATALOG_NAME) : "";
}

/** The user's catalogs, A–Z, with how many saved items each holds. */
export async function listCatalogs(userId: string): Promise<Catalog[]> {
  const rows = await db`
    SELECT c.id, c.name, count(s.id)::int AS count
    FROM catalogs c LEFT JOIN saved_responses s ON s.catalog_id = c.id
    WHERE c.user_id = ${userId}
    GROUP BY c.id
    ORDER BY lower(c.name)
  `;
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), count: Number(r.count) }));
}

/** The catalog with this name (any capitalization), created if it doesn't exist yet. */
export async function findOrCreateCatalog(userId: string, name: string): Promise<{ id: string; name: string }> {
  const rows = await db`
    INSERT INTO catalogs (user_id, name) VALUES (${userId}, ${name})
    ON CONFLICT (user_id, (lower(name))) DO UPDATE SET name = catalogs.name
    RETURNING id, name
  `;
  return { id: String(rows[0].id), name: String(rows[0].name) };
}

/** True if `catalogId` belongs to the user (so nobody can file into someone else's catalog). */
export async function ownsCatalog(userId: string, catalogId: string): Promise<boolean> {
  const rows = await db`SELECT 1 FROM catalogs WHERE id = ${catalogId} AND user_id = ${userId}`;
  return rows.length > 0;
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
