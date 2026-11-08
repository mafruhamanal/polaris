// A saved Ask conversation: the questions and answers of one session, in order.

export type Turn = { question: string; answer: string };

const MAX_TURNS = 100;
const MAX_QUESTION = 2_000;
const MAX_ANSWER = 8_000;

/** The valid turns from untrusted input, trimmed and capped. null if there is no usable turn. */
export function cleanConversation(input: unknown): Turn[] | null {
  if (!Array.isArray(input)) return null;
  const turns: Turn[] = [];
  for (const t of input.slice(0, MAX_TURNS)) {
    if (typeof t?.question !== "string" || typeof t?.answer !== "string") continue;
    const question = t.question.trim().slice(0, MAX_QUESTION);
    const answer = t.answer.trim().slice(0, MAX_ANSWER);
    if (question && answer) turns.push({ question, answer });
  }
  return turns.length > 0 ? turns : null;
}
