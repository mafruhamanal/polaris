// Define: a short, plain meaning of a word as it's used in a sentence, for the Mac's Word help.

import { generateJSON, type GeminiSchema } from "./gemini";

const SYSTEM = `You help a reader with dyslexia understand one word in what they're reading.
Give the meaning of WORD as it is used in SENTENCE, in one short sentence (at most 20 words).
Use simple, everyday words. Do not repeat the word itself at the start, and do not use the word to explain itself.
If it's a name of a person, place, or thing, say briefly who or what it is.
No Markdown.`;

const SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: { meaning: { type: "STRING" } },
  required: ["meaning"],
};

export async function define(word: string, sentence: string): Promise<string> {
  const prompt = `WORD: ${word.slice(0, 60).trim()}\n\nSENTENCE: ${sentence.slice(0, 1_000).trim()}`;
  const result = await generateJSON<{ meaning?: string }>({
    system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.2, timeoutMs: 12_000,
  });
  return (result.meaning ?? "").trim();
}
