// Ask: answers a question about the text the user selected on their Mac.
//
// The Mac app sends the selection plus the text just before and after it (when the app
// exposes it) and the window title. Gemini answers in JSON; we then keep only the
// evidence quotes that really appear in the text, so the Mac never highlights made-up quotes.

import { generateJSON, SCREENSHOT_NOTE, type GeminiSchema } from "./gemini";

export type AskInput = {
  question: string;
  selection: string;
  before?: string | null;
  after?: string | null;
  pageTitle?: string | null;
  /** Earlier questions and answers about the same selection, oldest first. */
  history?: { question: string; answer: string }[] | null;
  /** Base64 JPEG when the "selection" came from a screenshot (it's the recognized text). */
  image?: string | null;
};

export type AskResult = {
  /** false = the question isn't about the text; `suggestions` offers on-topic ones. */
  inScope: boolean;
  answer: string;
  /** false = general knowledge explaining something the text mentions. */
  fromText: boolean;
  /** Exact sentences from the text that support the answer (verified). */
  evidence: string[];
  /** Short follow-up questions for the suggestion chips. */
  suggestions: string[];
};

const SYSTEM = `You help a reader with dyslexia understand text they selected.
Answer ONLY questions about the selected text or its surrounding context.
This may be a follow-up: use EARLIER IN THIS CONVERSATION to understand words like "it" or "that".
You may use general knowledge to explain words or ideas the text mentions; set fromText=false when you do.
If the question is unrelated to the text, set inScope=false, say kindly that you can only help with the selected text, and suggest on-topic questions instead.
Use short sentences and plain words. No Markdown.
"evidence" must be exact sentences copied from the provided text (at most 3). Leave it empty if none apply.
"suggestions" are up to 3 short follow-up questions about the text, under 8 words each.`;

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    inScope: { type: "BOOLEAN" },
    answer: { type: "STRING" },
    fromText: { type: "BOOLEAN" },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    suggestions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["inScope", "answer", "fromText", "evidence", "suggestions"],
};

/** Caps on what we send to Gemini, so one request can't be huge. */
const MAX = { question: 500, selection: 20_000, context: 4_000, title: 300, turns: 6, answer: 1_500 };

const clip = (s: string | null | undefined, n: number) => (s ?? "").slice(0, n).trim();
const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export async function ask(input: AskInput): Promise<AskResult> {
  const question = clip(input.question, MAX.question);
  const selection = clip(input.selection, MAX.selection);
  const before = clip(input.before, MAX.context);
  const after = clip(input.after, MAX.context);
  const pageTitle = clip(input.pageTitle, MAX.title);
  const history = (Array.isArray(input.history) ? input.history : [])
    .filter((t) => typeof t?.question === "string" && typeof t?.answer === "string")
    .slice(-MAX.turns)
    .map((t) => `Q: ${clip(t.question, MAX.question)}\nA: ${clip(t.answer, MAX.answer)}`)
    .join("\n\n");

  const prompt = [
    pageTitle && `PAGE TITLE: ${pageTitle}`,
    before && `TEXT BEFORE:\n${before}`,
    `SELECTED TEXT (main focus):\n${selection || "(no text was recognized; answer from the screenshot)"}`,
    after && `TEXT AFTER:\n${after}`,
    input.image && SCREENSHOT_NOTE,
    history && `EARLIER IN THIS CONVERSATION:\n${history}`,
    `QUESTION: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await generateJSON<Partial<AskResult>>({
    system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.2, image: input.image,
  });

  // Keep only quotes that really appear in the text we sent.
  const source = normalize([before, selection, after].join(" "));
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

  return {
    inScope: raw.inScope !== false,
    answer: typeof raw.answer === "string" ? raw.answer : "",
    fromText: raw.fromText !== false,
    evidence: strings(raw.evidence).filter((q) => q.trim() && source.includes(normalize(q))).slice(0, 3),
    suggestions: strings(raw.suggestions).map((s) => s.trim()).filter(Boolean).slice(0, 3),
  };
}
