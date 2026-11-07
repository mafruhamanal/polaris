import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import SavedItemCard from "@/components/saved/SavedItemCard";
import Link from "next/link";

export default async function SavedPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const rows = await db`
    SELECT id, original_text, response, mode, source_app, source_url, created_at
    FROM saved_responses
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved responses</h1>
        <span className="text-sm text-gray-400">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-5xl">📭</div>
          <p className="text-gray-500 text-lg">Nothing saved yet.</p>
          <p className="text-sm text-gray-400">Use the Polaris Mac app to simplify or explain text — it&apos;ll appear here.</p>
          <Link href="/quiz" className="inline-block mt-2 text-blue-600 font-medium hover:underline">Take the quiz →</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={String(r.id)}>
              <SavedItemCard
                id={String(r.id)}
                originalText={String(r.original_text)}
                response={String(r.response)}
                mode={String(r.mode)}
                sourceApp={r.source_app ? String(r.source_app) : null}
                sourceUrl={r.source_url ? String(r.source_url) : null}
                createdAt={String(r.created_at)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
