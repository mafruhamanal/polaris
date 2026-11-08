import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";
import { SAVED_DEFAULTS, type SavedSettings, type SavedReadingLevel } from "@/lib/settings";
import { streamText, hasGeminiKey } from "@/lib/ai/gemini";
import { simplifySystem, simplifyPrompt } from "@/lib/ai/prompts";

type AskBody = {
  text: string;
  mode?: "simplify" | "explain";
  context?: { app?: string; title?: string; url?: string };
};

function geminiLevel(readingLevel: SavedReadingLevel): "simpler" | "simplest" {
  return readingLevel === "simple" ? "simplest" : "simpler";
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: AskBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { text, mode = "simplify", context } = body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  const trimmedText = text.slice(0, 20_000);

  // Load user's reading settings (fall back to defaults if none saved yet)
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

  // Run Gemini (or fall back to the original text if no key)
  let responseText = trimmedText;
  if (hasGeminiKey()) {
    try {
      const level = geminiLevel(settings.readingLevel);
      const chunks: string[] = [];
      for await (const chunk of streamText({
        system: simplifySystem(level),
        prompt: simplifyPrompt(trimmedText, context),
        temperature: 0.3,
        maxOutputTokens: 2048,
      })) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) responseText = chunks.join("");
    } catch (e) {
      console.warn("[ask] Gemini failed, returning original text:", e);
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
    console.warn("[ask] Failed to save response:", e);
  }

  return Response.json({ text: responseText, mode, settings, savedId });
}
