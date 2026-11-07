// Quiz questions and answer options for each setting (font, size, spacing, voice, level).
//
// The quiz finds what text and layout look easiest to *this* person. There's no
// timing and no right answer: every step is "Which is easier to read?"
//
//   1. INTAKE    — 1 quick question about the reader (kept for context only)
//   2. A/B ROUNDS — font, background, text size, spacing, line spacing, reading level.
//                  Each round shows the same short sample two ways, side by side.
//                  The winner stays on and the next option challenges it.
//   3. VOICE + SPEED — pick a voice (VOICES in settings.ts), set a speed
// Then scoring.ts turns the picks into a ReadingProfile.

import { type BackgroundId, FONTS, type ReaderSettings } from "../settings";

// ---------------------------------------------------------------------------
// 1. Intake
// ---------------------------------------------------------------------------

export type IntakeId = "hardest";

export interface IntakeQuestion {
  id: IntakeId;
  prompt: string;
  multi: boolean;
  options: { id: string; label: string }[];
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    // Collected for context only. These answers don't change any settings.
    id: "hardest",
    prompt: "What makes reading hard for you? Pick all that fit.",
    multi: true,
    options: [
      { id: "letters_move", label: "Letters look crowded or seem to move" },
      { id: "long_words", label: "Long words are hard to sound out" },
      { id: "understanding", label: "I read it but don't understand it" },
      { id: "tired", label: "I get tired fast" },
    ],
  },
];

/** Answers keyed by question id. Multi-select questions hold several option ids. */
export type IntakeAnswers = Partial<Record<IntakeId, string[]>>;

// ---------------------------------------------------------------------------
// 2. A/B rounds
// ---------------------------------------------------------------------------

/**
 * Short sample for the look-and-feel rounds. Uses letters that are easy to mix up
 * (b/d/p/q, m/n, u/n) so differences in font and spacing are noticeable.
 */
export const SAMPLE_TEXT =
  "Dad put a big bag of apples by the door. Then we walked down to the quiet pond to watch the birds.";

export type RoundId = "font" | "background" | "size" | "spacing" | "lineSpacing";

export interface RoundOption {
  id: string;
  /** Short name shown under the sample and used in the results ("bigger text"). */
  label: string;
  /** The settings this option changes. Render with settingsToStyle({ ...soFar, ...patch }). */
  patch: Partial<ReaderSettings>;
}

export interface Round {
  id: RoundId;
  prompt: string;
  /** First option starts as the champion; the rest challenge it in order. */
  options: RoundOption[];
}

const font = (id: (typeof FONTS)[number]["id"]): RoundOption => ({ id, label: id, patch: { font: id } });
const bg = (id: BackgroundId, label: string): RoundOption => ({ id, label, patch: { background: id } });

/** The rounds, in order. They're the same for everyone. */
export function buildRounds(): Round[] {
  const backgrounds = [
    bg("white", "white background"), bg("cream", "cream background"), bg("dark", "dark background"),
  ];

  return [
    {
      id: "font",
      prompt: "Which font is easier to read?",
      options: [font("Atkinson Hyperlegible"), font("Lexend"), font("Verdana"), font("OpenDyslexic")],
    },
    {
      id: "background",
      prompt: "Which background is easier on your eyes?",
      options: backgrounds,
    },
    {
      id: "size",
      prompt: "Which text size is easier to read?",
      // Start in the middle so the first comparison isn't extreme.
      options: [
        { id: "18", label: "medium text", patch: { fontSizePx: 18 } },
        { id: "22", label: "large text", patch: { fontSizePx: 22 } },
        { id: "16", label: "smaller text", patch: { fontSizePx: 16 } },
        { id: "26", label: "extra-large text", patch: { fontSizePx: 26 } },
      ],
    },
    {
      id: "spacing",
      prompt: "Which spacing between letters and words is easier?",
      // Letter and word spacing always grow together: wider letters with normal word
      // gaps made reading slower in Galliussi et al. (2020).
      options: [
        { id: "normal", label: "normal spacing", patch: { letterSpacingEm: 0, wordSpacingEm: 0 } },
        { id: "some", label: "a little more space between letters", patch: { letterSpacingEm: 0.05, wordSpacingEm: 0.1 } },
        { id: "more", label: "more space between letters", patch: { letterSpacingEm: 0.1, wordSpacingEm: 0.2 } },
        {
          id: "most",
          label: "lots of space between letters",
          patch: { letterSpacingEm: 0.15, wordSpacingEm: 0.3 },
        },
      ],
    },
    {
      id: "lineSpacing",
      prompt: "Which space between lines is easier?",
      options: [
        { id: "1.5", label: "medium line spacing", patch: { lineSpacing: 1.5 } },
        { id: "1.2", label: "tight line spacing", patch: { lineSpacing: 1.2 } },
        { id: "2", label: "wide line spacing", patch: { lineSpacing: 2 } },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. Voice and speed
// ---------------------------------------------------------------------------

export const VOICE_SAMPLE = "Hi! This is how I'll sound when I read to you.";
export const SPEED_CHOICES = [0.75, 0.9, 1, 1.15, 1.3, 1.5];
