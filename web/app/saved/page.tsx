import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, savedSettingsToStyle, type BackgroundId, type SavedSettings } from "@/lib/settings";
import SavedItemCard from "@/components/saved/SavedItemCard";
import CatalogBar from "@/components/saved/CatalogBar";
import { listCatalogs } from "@/lib/catalogs";
import Link from "next/link";

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ catalog?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const [allRows, settingsRows, catalogs] = await Promise.all([
    db`
      SELECT id, original_text, response, mode, source_app, source_url, created_at, title, catalog_id
      FROM saved_responses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `,
    db`
      SELECT font_family, font_size, letter_spacing, word_spacing, line_spacing, background, voice, reading_speed, reading_level
      FROM reader_settings WHERE user_id = ${userId} LIMIT 1
    `,
    listCatalogs(userId),
  ]);

  // ?catalog=<id> or ?catalog=unsorted filters the list; anything else shows everything.
  const requested = (await searchParams).catalog ?? "";
  const selected = requested === "unsorted" || catalogs.some((c) => c.id === requested) ? requested : "all";
  const rows = allRows.filter((r) =>
    selected === "all" ? true : selected === "unsorted" ? !r.catalog_id : String(r.catalog_id) === selected);
  const unsorted = allRows.filter((r) => !r.catalog_id).length;

  const settings: SavedSettings = settingsRows.length > 0 ? {
    fontFamily: settingsRows[0].font_family,
    fontSize: settingsRows[0].font_size,
    letterSpacing: settingsRows[0].letter_spacing,
    wordSpacing: settingsRows[0].word_spacing,
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
    <div className="space-y-6" style={{ zoom: 2/3 }}>
      <div style={{ zoom: 1.1 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Saved responses</h1>
          <span className="text-2xl text-star-white font-medium" style={{ zoom: 0.75 }}>{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
        </div>

        {allRows.length > 0 && (
          <CatalogBar catalogs={catalogs} selected={selected} total={allRows.length} unsorted={unsorted} />
        )}
      </div>

      {allRows.length > 0 && rows.length === 0 ? (
        <p className="text-center py-16 text-xl text-star-white">Nothing in this catalog yet. Notes you save to it from the Mac app will show up here.</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-9xl">📭</div>
          <p className="text-star-white text-3xl">Nothing saved yet.</p>
          <p className="text-xl text-star-white">Use the Polaris Mac app to simplify text or write notes by talking — they&apos;ll appear here.</p>
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
                title={r.title ? String(r.title) : null}
                readingStyle={readingStyle}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
