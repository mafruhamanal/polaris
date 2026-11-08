import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, savedSettingsToStyle, type BackgroundId, type SavedSettings } from "@/lib/settings";
import SavedItemCard from "@/components/saved/SavedItemCard";
import Link from "next/link";

export default async function SavedPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const [rows, settingsRows] = await Promise.all([
    db`
      SELECT id, original_text, response, mode, source_app, source_url, created_at
      FROM saved_responses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `,
    db`
      SELECT font_family, font_size, letter_spacing, line_spacing, background, voice, reading_speed, reading_level
      FROM reader_settings WHERE user_id = ${userId} LIMIT 1
    `,
  ]);

  const settings: SavedSettings = settingsRows.length > 0 ? {
    fontFamily: settingsRows[0].font_family,
    fontSize: settingsRows[0].font_size,
    letterSpacing: settingsRows[0].letter_spacing,
    wordSpacing: 0,
    lineSpacing: settingsRows[0].line_spacing,
    background: settingsRows[0].background as BackgroundId,
    voice: settingsRows[0].voice,
    readingSpeed: settingsRows[0].reading_speed,
    readingLevel: settingsRows[0].reading_level,
  } : SAVED_DEFAULTS;

  const textStyle = savedSettingsToStyle(settings);
  const readingStyle = {
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    letterSpacing: textStyle.letterSpacing,
    lineHeight: textStyle.lineHeight,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Saved responses</h1>
        <span className="text-base text-star-dim">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-9xl">📭</div>
          <p className="text-star-dim text-3xl">Nothing saved yet.</p>
          <p className="text-xl text-star-dim">Use the Polaris Mac app to simplify or explain text — it&apos;ll appear here.</p>
          <Link href="/quiz" className="inline-block mt-2 text-nebula-teal text-xl font-medium hover:underline">Take the quiz →</Link>
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
                readingStyle={readingStyle}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
