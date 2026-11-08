import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, resolveFont, sanitizeSavedSettings, type SavedSettings } from "@/lib/settings";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db`
    SELECT font_family, font_size, letter_spacing, word_spacing, line_spacing, background, voice, reading_speed, reading_level
    FROM reader_settings WHERE user_id = ${userId}
  `;

  if (rows.length === 0) return Response.json(SAVED_DEFAULTS);

  const r = rows[0];
  const settings: SavedSettings = {
    fontFamily: resolveFont(r.font_family),
    fontSize: r.font_size,
    letterSpacing: r.letter_spacing,
    wordSpacing: r.word_spacing,
    lineSpacing: r.line_spacing,
    background: r.background,
    voice: r.voice,
    readingSpeed: r.reading_speed,
    readingLevel: r.reading_level,
  };
  return Response.json(settings);
}

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = sanitizeSavedSettings(await req.json());

  const rows = await db`
    INSERT INTO reader_settings (user_id, font_family, font_size, letter_spacing, word_spacing, line_spacing, background, voice, reading_speed, reading_level, updated_at)
    VALUES (${userId}, ${body.fontFamily}, ${body.fontSize}, ${body.letterSpacing}, ${body.wordSpacing}, ${body.lineSpacing}, ${body.background}, ${body.voice}, ${body.readingSpeed}, ${body.readingLevel}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      font_family = EXCLUDED.font_family,
      font_size = EXCLUDED.font_size,
      letter_spacing = EXCLUDED.letter_spacing,
      word_spacing = EXCLUDED.word_spacing,
      line_spacing = EXCLUDED.line_spacing,
      background = EXCLUDED.background,
      voice = EXCLUDED.voice,
      reading_speed = EXCLUDED.reading_speed,
      reading_level = EXCLUDED.reading_level,
      updated_at = now()
    RETURNING *
  `;

  const r = rows[0];
  const settings: SavedSettings = {
    fontFamily: resolveFont(r.font_family),
    fontSize: r.font_size,
    letterSpacing: r.letter_spacing,
    wordSpacing: r.word_spacing,
    lineSpacing: r.line_spacing,
    background: r.background,
    voice: r.voice,
    readingSpeed: r.reading_speed,
    readingLevel: r.reading_level,
  };
  return Response.json(settings);
}
