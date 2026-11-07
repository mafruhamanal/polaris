import { redirect } from "next/navigation";
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, type SavedSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const rows = await db`
    SELECT font_family, font_size, letter_spacing, line_spacing, background, voice, reading_speed, reading_level
    FROM reader_settings WHERE user_id = ${userId}
  `;

  const settings: SavedSettings = rows.length === 0 ? SAVED_DEFAULTS : {
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
    <main className="p-8 max-w-lg">
      <h1 className="text-xl font-bold mb-4">Settings</h1>
      <pre className="bg-gray-100 rounded p-4 text-xs mb-6 overflow-auto">
        {JSON.stringify(settings, null, 2)}
      </pre>
      <SettingsForm current={settings} />
    </main>
  );
}
