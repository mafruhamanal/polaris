import { auth } from "@/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";

export async function getUserId(): Promise<string | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const rows = await db`
      SELECT user_id FROM mac_device_tokens WHERE token = ${token} LIMIT 1
    `;
    return rows[0]?.user_id ?? null;
  }

  const session = await auth();
  if (!session?.user?.email) return null;

  const rows = await db`
    INSERT INTO users (email, name)
    VALUES (${session.user.email}, ${session.user.name ?? null})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  return rows[0].id;
}
