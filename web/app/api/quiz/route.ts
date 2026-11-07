// AI help for the quiz (results summary) plus a reading-level rewrite helper.
//
// POST /api/quiz  with JSON  { action, ...params }
//
//   { action: "levels", text }                  → { original, simpler, simplest }
//   { action: "profile", answers }              → { settings, profile, summary, perSetting }   ← results screen uses this
//        settings = the saved format (SavedSettings) → send this to PUT /api/settings
//        profile  = the quiz's own settings + reasons, for showing the results on the web
//
// Every response includes  source: "ai" | "fallback".  If Gemini is missing, slow or
// returns junk, the route answers from built-in content and rules instead, so the
// quiz never breaks during a demo.

import {
  EXPLAIN_SCHEMA, EXPLAIN_SYSTEM, explainPrompt,
  LEVELS_SCHEMA, LEVELS_SYSTEM, levelsPrompt,
} from "@/lib/ai/prompts";
import { generateJSON, hasGeminiKey } from "@/lib/ai/gemini";
import { buildProfile, type QuizAnswers } from "@/lib/quiz/scoring";
import { type ReadingProfile, toSavedSettings } from "@/lib/settings";

type Json = Record<string, unknown>;
const ok = (data: Json, source: "ai" | "fallback") => Response.json({ ...data, source });
const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  let body: Json;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON");
  }

  switch (body.action) {
    case "levels":
      if (typeof body.text !== "string" || !body.text.trim()) return bad("text is required");
      return levels(body.text.slice(0, 4000));
    case "profile": {
      if (!body.answers || typeof body.answers !== "object") return bad("answers is required");
      const answers = body.answers as QuizAnswers;
      if (!answers.intake || !answers.picks || typeof answers.picks !== "object") return bad("answers needs intake and picks");
      const profile = buildProfile(answers);
      const res = await explain(profile);
      const explanation = await res.json();
      return Response.json({ settings: toSavedSettings(profile.settings), profile, ...explanation });
    }
    default:
      return bad(`Unknown action. Use one of: levels, profile`);
  }
}

// ---------------------------------------------------------------------------

async function levels(text: string) {
  if (hasGeminiKey()) {
    try {
      const out = await generateJSON<{ original: string; simpler: string; simplest: string }>({
        system: LEVELS_SYSTEM,
        prompt: levelsPrompt(text),
        schema: LEVELS_SCHEMA,
        temperature: 0.3,
      });
      if (out.simpler && out.simplest) return ok({ original: text, simpler: out.simpler, simplest: out.simplest }, "ai");
    } catch (e) {
      console.warn("[quiz] levels fell back:", e);
    }
  }
  return ok({ original: text, simpler: text, simplest: text }, "fallback");
}

// ---------------------------------------------------------------------------

function templateExplanation(profile: ReadingProfile) {
  const perSetting = Object.fromEntries(Object.entries(profile.evidence ?? {}).filter(([, v]) => v));
  // Spacing evidence is repeated for size/line spacing; say it once in the summary.
  const lines = [...new Set(Object.values(perSetting))].slice(0, 4);
  const summary = ["Nice work! Here's what we found.", ...lines, "You can change any of these at any time."].join(" ");
  return { summary, perSetting };
}

async function explain(profile: ReadingProfile) {
  if (hasGeminiKey()) {
    try {
      const out = await generateJSON<{ summary: string; perSetting?: Record<string, string | null> }>({
        system: EXPLAIN_SYSTEM,
        prompt: explainPrompt(JSON.stringify({ settings: profile.settings, evidence: profile.evidence })),
        schema: EXPLAIN_SCHEMA,
        temperature: 0.5,
        timeoutMs: 12_000,
      });
      if (out.summary) {
        const perSetting = Object.fromEntries(Object.entries(out.perSetting ?? {}).filter(([, v]) => typeof v === "string" && v));
        return ok({ summary: out.summary, perSetting }, "ai");
      }
    } catch (e) {
      console.warn("[quiz] explain fell back:", e);
    }
  }
  return ok(templateExplanation(profile), "fallback");
}
