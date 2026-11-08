// Prepares text to be read aloud: URLs and citations are dropped, and abbreviations,
// money, units, ranges and the like are spelled out ("Dr." → "Doctor", "$1.2M" → "1.2 million dollars").
//
// Returns *edits* to the original text instead of a rewritten string, so the Mac can keep
// highlighting the words the user actually sees while a different text is spoken.
// URLs and citations are removed locally; Gemini is only called when some other word needs
// spelling out, so plain text costs nothing and never waits on the AI.

import { generateJSON, hasGeminiKey, type GeminiSchema } from "./gemini";

/** Replace original[start, end) with `spoken` ("" = don't read it). Offsets are UTF-16, like Swift's NSString. */
export type SpeechEdit = { start: number; end: number; spoken: string };

const MAX_CHARS = 20_000;
/** At most this many words go to Gemini in one request, which keeps the answer short and fast. */
const MAX_AI_TOKENS = 300;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|edu|gov|io|co|uk|dev|app|ai)(?:\/\S*)?(?![\w-])/gi;
const CITATION_RE = /\[(?:\d+(?:\s*[,–-]\s*\d+)*|citation needed)\]/gi;
// Author-year citations, which span several words: (Smith, 2020), (Smith & Jones, 2020, p. 5),
// (Smith et al., 2020; Lee, 2019), (see Lee 2019a) and the year in "Smith (2020) argued".
// Written to be strict (a capitalized surname and a real year), so ordinary parentheses are left alone.
const AUTHOR = String.raw`\p{Lu}[\p{L}'’-]+`;
const AUTHORS = String.raw`${AUTHOR}(?:(?:,\s*(?:(?:and|&)\s+)?|\s+(?:and|&)\s+)${AUTHOR})*(?:,?\s+et\s+al\.?)?`;
const YEAR = String.raw`(?:(?:1[5-9]\d{2}|20\d{2})[a-z]?|n\.d\.|forthcoming)`;
const YEARS = String.raw`${YEAR}(?:\s*,\s*${YEAR})*`;
const PAGES = String.raw`,?\s*pp?\.\s*\d+(?:\s*[–-]\s*\d+)?`;
const LEAD = String.raw`(?:(?:e\.g\.|i\.e\.|[Ss]ee(?:\s+also)?|cf\.),?\s+)`;
const SEGMENT = String.raw`${LEAD}?${AUTHORS},?\s*${YEARS}(?:${PAGES})?`;
const AUTHOR_CITATION_RE = new RegExp(
  String.raw`[(\[]\s*${SEGMENT}(?:\s*;\s*${SEGMENT})*\s*[)\]]` +
    String.raw`|(?<=${AUTHOR}(?:\s+et\s+al\.?)?\s)\(\s*${YEARS}(?:${PAGES})?\s*\)`,
  "gu",
);

const TRAILING_PUNCT_RE = /[.,;:!?)\]"'’”]+$/;

/** Words that are better spelled out. Deliberately generous: Gemini leaves the ones that read fine. */
const NEEDS_AI = [
  /^(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Mt|vs|etc|Inc|Ltd|Co|Corp|Dept|Gov|Sen|Rep|Gen|Col|Capt|Lt|Sgt|Rev|Hon|Fig|No|approx|est)\./i,
  /\b(?:[A-Za-z]\.){2,}/, // U.S., e.g., a.m.
  /[$€£¥%°#&@+=×÷±]/,
  /\d[A-Za-z]|[A-Za-z]\d/, // 1.2M, 5km, 3rd
  /\d[\/–-]\d/, // dates and ranges: 3/4/2021, 2020-2024
  /(?<![A-Za-z])[A-Z]{2,}(?:s|['’]s)?(?![A-Za-z])/, // acronyms: FBI, NASA, HTML (and ALL-CAPS words, which Gemini leaves alone)
];

const SYSTEM = `You prepare text to be read aloud by a text-to-speech voice, for a reader with dyslexia.
You get the full text for context, then a numbered list of words from it. For each word that would be read badly or unclearly, give the words to SAY instead.
- Expand abbreviations: "Dr." → "Doctor", "vs." → "versus", "e.g." → "for example", "i.e." → "that is", "etc." → "et cetera". Use the context to decide ("St." is "Saint" or "Street").
- Say money, percentages, units, ordinals, dates, times and ranges the way a person would: "$1.2M" → "1.2 million dollars", "5km" → "5 kilometers", "3rd" → "third", "2020-2024" → "2020 to 2024".
- Acronyms and initialisms: decide how a person would SAY them, using the context. Ones said letter by letter get spaced letters: "FBI" → "F B I", "HTML" → "H T M L", "FBIs" → "F B I's". Ones said as a word ("NASA", "NATO", "LASER") stay as they are, so leave them out. Do NOT expand them into their full names. Roman numerals follow the context ("World War II" → "World War 2", "Henry VIII" → "Henry the eighth").
- Ordinary words written in capitals (like "IMPORTANT") stay as they are, so leave them out.
- Keep any punctuation at the end of the word (comma, period) so the pauses stay.
- If a word already reads fine as it is, leave it out of the answer.
- Never change the meaning and never add information.`;

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { i: { type: "INTEGER" }, spoken: { type: "STRING" } },
        required: ["i", "spoken"],
      },
    },
  },
  required: ["items"],
};

type Token = { start: number; end: number; orig: string; clean: string };

/** Drops URLs and citation numbers from one word, keeping punctuation that follows a URL. */
function stripClutter(word: string): string {
  return word
    .replace(CITATION_RE, "")
    .replace(URL_RE, (m) => m.match(TRAILING_PUNCT_RE)?.[0] ?? "");
}

export async function prepareSpeech(input: string): Promise<{ edits: SpeechEdit[]; usedAI: boolean }> {
  const text = input.slice(0, MAX_CHARS);

  // Author-year citations come out whole. Blank them so the word pass below never sees them.
  const edits: SpeechEdit[] = [];
  let masked = text;
  for (const m of text.matchAll(AUTHOR_CITATION_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    edits.push({ start, end, spoken: "" });
    masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
  }

  const tokens: Token[] = [];
  for (const m of masked.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    tokens.push({ start, end: start + m[0].length, orig: m[0], clean: stripClutter(m[0]) });
  }

  // Words (after clutter is gone) that something other than the voice should look at.
  const flagged = tokens
    .map((t, i) => ({ i, t }))
    .filter(({ t }) => t.clean && NEEDS_AI.some((re) => re.test(t.clean)))
    .slice(0, MAX_AI_TOKENS);

  const spokenByToken = new Map<number, string>();
  let usedAI = false;
  if (flagged.length > 0 && hasGeminiKey()) {
    try {
      const raw = await generateJSON<{ items?: { i?: unknown; spoken?: unknown }[] }>({
        system: SYSTEM,
        prompt: `FULL TEXT:\n${text}\n\nWORDS TO CHECK:\n${flagged.map(({ i, t }) => `${i}: ${JSON.stringify(t.clean)}`).join("\n")}`,
        schema: SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 2048,
        timeoutMs: 15_000,
      });
      const allowed = new Set(flagged.map(({ i }) => i));
      for (const item of Array.isArray(raw.items) ? raw.items : []) {
        // Only accept answers for words we asked about, and only sane ones.
        if (typeof item?.i !== "number" || !allowed.has(item.i)) continue;
        if (typeof item.spoken !== "string" || item.spoken.length > 200) continue;
        const spoken = item.spoken.replace(/\s+/g, " ").trim();
        if (spoken) spokenByToken.set(item.i, spoken);
      }
      usedAI = true;
    } catch (e) {
      // The text is still readable without the AI step, so don't fail the request.
      console.warn("[speech-prep] Gemini failed, only removing URLs and citations:", e);
    }
  }

  tokens.forEach((t, i) => {
    const spoken = spokenByToken.get(i) ?? t.clean;
    if (spoken !== t.orig) edits.push({ start: t.start, end: t.end, spoken });
  });
  edits.sort((a, b) => a.start - b.start);
  return { edits, usedAI };
}
