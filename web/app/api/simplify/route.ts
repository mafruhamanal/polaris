// POST /api/simplify — the Mac app's Simplify feature.
// Body: { text, mode?, context?, image? } → simplifies `text` at the user's reading level, saves it to
// saved_responses, and returns { text, mode, settings, savedId }. With `image` (a base64 JPEG
// screenshot), `text` is the text recognized from it and may be empty.
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, resolveFont, type SavedSettings, type SavedReadingLevel } from "@/lib/settings";
import { streamText, hasGeminiKey, imageFrom, SCREENSHOT_NOTE } from "@/lib/ai/gemini";
import { simplifySystem, simplifyPrompt } from "@/lib/ai/prompts";

type SimplifyBody = {
  text: string;
  mode?: "simplify" | "explain";
  context?: { app?: string; title?: string; url?: string };
  image?: string;
};

function geminiLevel(readingLevel: SavedReadingLevel): "simpler" | "simplest" {
  return readingLevel === "simple" ? "simplest" : "simpler";
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: SimplifyBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { mode = "simplify", context } = body;
  const image = imageFrom(body.image);
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim() && !image) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  const trimmedText = text.trim() ? text.slice(0, 20_000) : "(screenshot)";

  // Load user's reading settings (fall back to defaults if none saved yet)
  const rows = await db`
    SELECT font_family, font_size, letter_spacing, word_spacing, line_spacing, background, voice, reading_speed, reading_level
    FROM reader_settings WHERE user_id = ${userId}
  `;

  const settings: SavedSettings = rows.length === 0 ? SAVED_DEFAULTS : {
    fontFamily: resolveFont(rows[0].font_family),
    fontSize: rows[0].font_size,
    letterSpacing: rows[0].letter_spacing,
    wordSpacing: rows[0].word_spacing,
    lineSpacing: rows[0].line_spacing,
    background: rows[0].background,
    voice: rows[0].voice,
    readingSpeed: rows[0].reading_speed,
    readingLevel: rows[0].reading_level,
  };

  // Run Gemini (or fall back to the original text if no key)
  let responseText = trimmedText;
  if (hasGeminiKey()) {
    try {
      const level = geminiLevel(settings.readingLevel);
      const chunks: string[] = [];
      for await (const chunk of streamText({
        system: simplifySystem(level),
        prompt: simplifyPrompt(trimmedText, context) + (image ? `\n\n${SCREENSHOT_NOTE}` : ""),
        image,
        temperature: 0.3,
        maxOutputTokens: 2048,
      })) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) responseText = chunks.join("");
    } catch (e) {
      console.warn("[simplify] Gemini failed, returning original text:", e);
    }
  }

  // Save to saved_responses
  let savedId: string | null = null;
  try {
    const saved = await db`
      INSERT INTO saved_responses (user_id, original_text, response, mode, source_app, source_url, source_window)
      VALUES (
        ${userId}, ${trimmedText}, ${responseText}, ${mode},
        ${context?.app ?? null}, ${context?.url ?? null}, ${context?.title ?? null}
      )
      RETURNING id
    `;
    savedId = String(saved[0].id);
  } catch (e) {
    console.warn("[simplify] Failed to save response:", e);
  }

  return Response.json({ text: responseText, mode, settings, savedId });
}
