import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db`
    INSERT INTO mac_device_tokens (user_id, token)
    VALUES (${userId}, gen_random_uuid()::text)
    RETURNING token
  `;

  return Response.json({ token: rows[0].token }, { status: 201 });
}
