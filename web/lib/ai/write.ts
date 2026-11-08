// Write: turns what the user said out loud into clear writing.
//
// The Mac app transcribes speech on-device (Apple speech recognition) and sends the transcript,
// plus the text the user had selected (if any) as context. Gemini returns a title, the notes,
// and the catalog they best fit.

import { generateJSON, type GeminiSchema } from "./gemini";

export type WriteInput = {
  transcript: string;
  /** Text the user had selected when they started, so the note can be about it. */
  selection?: string | null;
  pageTitle?: string | null;
  /** Names of the user's existing catalogs. */
  catalogs?: string[];
  readingLevel?: string | null;
};

export type WriteResult = {
  title: string;
  note: string;
  /** An existing catalog's exact name, a suggested new name, or "". */
  catalog: string;
};

const LEVEL_GUIDE: Record<string, string> = {
  simple: "Use very simple words and very short sentences.",
  standard: "Use short sentences and plain words.",
  advanced: "Use clear, well-organized sentences; everyday adult vocabulary is fine.",
};

const SYSTEM = `You help a person with dyslexia turn their spoken thoughts into clear writing.
The transcript comes from speech recognition, so it may ramble, repeat itself, or contain misheard words: fix obvious mistakes using the context.
Keep their meaning and every important detail (names, dates, numbers). Do not add facts they didn't say.
If SELECTED TEXT is given, they were looking at it while talking; use it to understand what they mean, but write about what THEY said.
No Markdown (no #, ** or - bullets).
"title" is 2 to 6 words.
"catalog" is the folder this note belongs in: if one of EXISTING CATALOGS fits, return its exact name; otherwise suggest a short new name (1 to 4 words), or "" if nothing is clear.`;

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    note: { type: "STRING" },
    catalog: { type: "STRING" },
  },
  required: ["title", "note", "catalog"],
};

const MAX = { transcript: 20_000, selection: 4_000, title: 300, catalogs: 100 };

const clip = (s: string | null | undefined, n: number) => (s ?? "").slice(0, n).trim();

export async function write(input: WriteInput): Promise<WriteResult> {
  const catalogs = (input.catalogs ?? []).slice(0, MAX.catalogs);
  const selection = clip(input.selection, MAX.selection);
  const pageTitle = clip(input.pageTitle, MAX.title);

  const prompt = [
    pageTitle && `PAGE TITLE: ${pageTitle}`,
    selection && `SELECTED TEXT:\n${selection}`,
    `EXISTING CATALOGS: ${catalogs.length ? catalogs.map((c) => `"${c}"`).join(", ") : "(none yet)"}`,
    `WRITE IT AS: notes. One or two short sentences summing up, then each key point on its own line starting with "• ".`,
    LEVEL_GUIDE[input.readingLevel ?? ""] ?? LEVEL_GUIDE.standard,
    `TRANSCRIPT:\n${clip(input.transcript, MAX.transcript)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await generateJSON<WriteResult>({ system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.3 });

  // Use the existing catalog's exact spelling if Gemini picked one with different capitalization.
  const suggested = (result.catalog ?? "").trim();
  const existing = catalogs.find((c) => c.toLowerCase() === suggested.toLowerCase());
  return {
    title: (result.title ?? "").trim(),
    note: (result.note ?? "").trim(),
    catalog: existing ?? suggested.slice(0, 60),
  };
}
