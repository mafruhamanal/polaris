// Shared ReaderSettings type and default settings used by the quiz, API, and Mac app.
// Keep in sync with mac/Sources/Polaris/Settings/ReaderSettings.swift.
export type ReaderSettings = {
  /** "system", "serif", "rounded", "monospace", or an installed font's name. */
  fontFamily: string;
  fontSize: number;
  /** Extra space between letters, as a fraction of the font size (0.05 = 5%). */
  letterSpacing: number;
  /** Line height as a multiple of the normal height. */
  lineSpacing: number;
  /** macOS voice identifier; null uses the system voice. */
  voice: string | null;
  /** Speech speed multiplier (1.0 = normal). */
  readingSpeed: number;
  readingLevel: "simple" | "standard" | "advanced";
};

export const defaultSettings: ReaderSettings = {
  fontFamily: "system",
  fontSize: 16,
  letterSpacing: 0,
  lineSpacing: 1.4,
  voice: null,
  readingSpeed: 1.0,
  readingLevel: "standard",
};
