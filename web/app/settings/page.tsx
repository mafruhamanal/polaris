import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, type SavedSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";
import Link from "next/link";

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const rows = await db`
    SELECT font_family, font_size, letter_spacing, line_spacing, background, voice, reading_speed, reading_level
    FROM reader_settings WHERE user_id = ${userId}
  `;

  const hasSettings = rows.length > 0;
  const settings: SavedSettings = !hasSettings ? SAVED_DEFAULTS : {
    fontFamily: rows[0].font_family,
    fontSize: rows[0].font_size,
    letterSpacing: rows[0].letter_spacing,
    lineSpacing: rows[0].line_spacing,
    background: rows[0].background,
    voice: rows[0].voice,
    readingSpeed: rows[0].reading_speed,
    readingLevel: rows[0].reading_level,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your settings</h1>
        <Link href="/quiz" className="text-sm text-blue-600 font-medium hover:underline">Retake quiz →</Link>
      </div>

      {!hasSettings && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          You haven&apos;t taken the quiz yet — these are the defaults.{" "}
          <Link href="/quiz" className="font-semibold underline">Take the quiz</Link> to find your best settings.
        </div>
      )}

      <SettingsForm settings={settings} />
    </div>
  );
}
