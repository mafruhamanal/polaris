import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

export default async function SavedPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const rows = await db`
    SELECT id, original_text, response, mode, source_app, created_at
    FROM saved_responses
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Saved responses</h1>
      {rows.length === 0 ? (
        <p className="text-gray-500">No saved responses yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="border rounded p-4 space-y-1">
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="font-mono bg-gray-100 px-1 rounded">{r.mode}</span>
                {r.source_app && <span>{r.source_app}</span>}
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm"><span className="font-medium">Original: </span>{String(r.original_text).slice(0, 120)}{r.original_text.length > 120 ? "…" : ""}</p>
              <p className="text-sm"><span className="font-medium">Response: </span>{String(r.response).slice(0, 120)}{r.response.length > 120 ? "…" : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
