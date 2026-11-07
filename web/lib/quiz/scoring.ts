// Turns the user's quiz answers into a ReaderSettings object.
//
// The quiz is about what looks easiest to this person, so their picks decide the
// settings directly. Rules, not AI, build the result: instant, predictable in a demo,
// and every setting comes with a plain reason. The AI only phrases the final summary.

import { DEFAULT_SETTINGS, type ReaderSettings, type ReadingProfile, sanitizeSettings } from "../settings";
import { buildRounds, type IntakeAnswers, type RoundId } from "./questions";

// ---------------------------------------------------------------------------
// Answer shapes (what the quiz UI collects)
// ---------------------------------------------------------------------------

/** The winner of one A/B round. */
export interface RoundPick {
  /** id of the winning RoundOption */
  optionId: string;
  /** How many comparisons the winner won (championWins). Used in the explanation. */
  wins: number;
}

export interface QuizAnswers {
  intake: IntakeAnswers;
  /** One entry per finished round. Missing rounds keep the default. */
  picks: Partial<Record<RoundId, RoundPick>>;
  /** macOS voice id, or null for the Mac default. Leave undefined if they skipped. */
  voice?: string | null;
  speed?: number;
}

// ---------------------------------------------------------------------------
// A/B tournament (used by every round)
// ---------------------------------------------------------------------------
// The winner stays on, the next option challenges it. N options = N-1 comparisons.

export interface Tournament<T> {
  champion: T;
  queue: T[];
  history: { winner: T; loser: T }[];
}

export function startTournament<T>(options: T[]): Tournament<T> {
  if (options.length === 0) throw new Error("Tournament needs at least one option");
  return { champion: options[0], queue: options.slice(1), history: [] };
}

/** The two options to show now, or null when the round is finished. */
export function currentPair<T>(t: Tournament<T>): [T, T] | null {
  return t.queue.length ? [t.champion, t.queue[0]] : null;
}

/** Record which of the current pair the user picked. Returns a new state. */
export function pick<T>(t: Tournament<T>, winner: T): Tournament<T> {
  const pair = currentPair(t);
  if (!pair) return t;
  const [a, b] = pair;
  if (winner !== a && winner !== b) throw new Error("Winner must be one of the current pair");
  const loser = winner === a ? b : a;
  return { champion: winner, queue: t.queue.slice(1), history: [...t.history, { winner, loser }] };
}

export function championWins<T>(t: Tournament<T>): number {
  return t.history.filter((h) => h.winner === t.champion).length;
}

// ---------------------------------------------------------------------------
// Put it all together
// ---------------------------------------------------------------------------

/** Which setting's explanation each round fills in. */
export const EVIDENCE_KEY: Record<RoundId, keyof ReaderSettings> = {
  font: "font",
  background: "background",
  size: "fontSizePx",
  spacing: "letterSpacingEm",
  lineSpacing: "lineSpacing",
};

/**
 * Builds the profile from whatever has been answered so far, so the UI can also call
 * it mid-quiz to render the next round in the settings already picked:
 *   const soFar = buildProfile(answers).settings;
 */
export function buildProfile(answers: QuizAnswers, now: Date = new Date()): ReadingProfile {
  const { picks = {} } = answers;
  let s: ReaderSettings = { ...DEFAULT_SETTINGS };
  const evidence: ReadingProfile["evidence"] = {};

  // Picks from the A/B rounds set the look. (The "what makes reading
  // hard?" answers are kept for context only and don't change settings.)
  for (const round of buildRounds()) {
    const p = picks[round.id];
    const option = p && round.options.find((o) => o.id === p.optionId);
    if (!option) continue;
    s = { ...s, ...option.patch };
    evidence[EVIDENCE_KEY[round.id]] =
      p.wins >= 2
        ? `You picked ${option.label} over ${p.wins} other options.`
        : `You picked ${option.label} as easier to read.`;
  }

  // Voice and speed (used when they press Read aloud).
  if (answers.voice !== undefined) {
    s.ttsVoice = answers.voice;
    evidence.ttsVoice = "You picked this voice.";
  }
  if (answers.speed) {
    s.ttsSpeed = answers.speed;
    evidence.ttsSpeed = `You set the reading speed to ${answers.speed}x.`;
  }

  return { settings: sanitizeSettings(s), evidence, createdAt: now.toISOString() };
}
