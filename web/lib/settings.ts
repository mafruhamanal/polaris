import type React from "react";

// Shared ReaderSettings type and default settings used by the quiz, API, and Mac app.
//
// Two shapes live here:
//   ReaderSettings — what the quiz works with on the web (also drives the web previews).
//   SavedSettings  — the exact object saved with PUT /api/settings and read by the Mac app.
//                    Convert with toSavedSettings(); clean incoming objects with sanitizeSavedSettings().

export type FontFamily =
  | "Atkinson Hyperlegible"
  | "Lexend"
  | "Verdana"
  | "OpenDyslexic"
  | "Arial";

export type ReadingLevel = "original" | "simpler" | "simplest";

export interface ReaderSettings {
  font: FontFamily;
  fontSizePx: number;
  /** Extra space between letters, in em. 0 = normal. */
  letterSpacingEm: number;
  /** Extra space between words, in em. 0 = normal. */
  wordSpacingEm: number;
  /** Line height as a multiple of font size. */
  lineSpacing: number;
  /** Background tint id (see BACKGROUNDS). */
  background: BackgroundId;
  readingLevel: ReadingLevel;
  /** macOS voice id (see VOICES). null = the Mac's default voice. */
  ttsVoice: string | null;
  /** Playback rate. 1 = normal. */
  ttsSpeed: number;
}

/** What the quiz produces: settings plus the plain-language reasons behind them. */
export interface ReadingProfile {
  settings: ReaderSettings;
  /** One short, user-facing sentence per setting the quiz decided. */
  evidence: Partial<Record<keyof ReaderSettings, string>>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Options the quiz chooses between (also handy for a settings page)
// ---------------------------------------------------------------------------

export const FONTS: { id: FontFamily; cssFamily: string; note: string }[] = [
  { id: "Atkinson Hyperlegible", cssFamily: "'Atkinson Hyperlegible', Verdana, sans-serif", note: "Designed so similar letters look different" },
  { id: "Lexend", cssFamily: "'Lexend', Verdana, sans-serif", note: "Wide letters built for easier reading" },
  { id: "Verdana", cssFamily: "Verdana, sans-serif", note: "Classic wide sans serif" },
  { id: "OpenDyslexic", cssFamily: "'OpenDyslexic', Verdana, sans-serif", note: "Heavy-bottomed letters; works for some people" },
  { id: "Arial", cssFamily: "Arial, sans-serif", note: "Common default" },
];

export type BackgroundId = "white" | "cream" | "dark";

export const BACKGROUNDS: Record<BackgroundId, { label: string; bg: string; text: string }> = {
  white: { label: "White", bg: "#FFFFFF", text: "#1A1A1A" },
  cream: { label: "Cream", bg: "#FBF5E6", text: "#1A1A1A" },
  dark: { label: "Dark", bg: "#1E1E24", text: "#E8E6E3" },
};


export const LIMITS = {
  fontSizePx: { min: 10, max: 36 },
  letterSpacingEm: { min: 0, max: 0.35 },
  wordSpacingEm: { min: 0, max: 0.5 },
  lineSpacing: { min: 1.1, max: 2.5 },
  ttsSpeed: { min: 0.5, max: 2 },
} as const;

export const DEFAULT_SETTINGS: ReaderSettings = {
  font: "Atkinson Hyperlegible",
  fontSizePx: 18,
  letterSpacingEm: 0.05,
  wordSpacingEm: 0.1,
  lineSpacing: 1.5,
  background: "cream",
  readingLevel: "original",
  ttsVoice: null,
  ttsSpeed: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Turns any untrusted object (request body, AI output, old saved row) into valid
 * ReaderSettings. Unknown or bad fields fall back to the default. Use this in
 * PUT /api/settings before writing to the database.
 */
export function sanitizeSettings(input: unknown, base: ReaderSettings = DEFAULT_SETTINGS): ReaderSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const num = (k: keyof typeof LIMITS, step: number) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v)
      ? +round(clamp(v, LIMITS[k].min, LIMITS[k].max), step).toFixed(3)
      : (base[k] as number);
  };

  return {
    font: FONTS.some((f) => f.id === o.font) ? (o.font as FontFamily) : base.font,
    fontSizePx: num("fontSizePx", 1),
    letterSpacingEm: num("letterSpacingEm", 0.01),
    wordSpacingEm: num("wordSpacingEm", 0.01),
    lineSpacing: num("lineSpacing", 0.05),
    background: typeof o.background === "string" && o.background in BACKGROUNDS ? (o.background as BackgroundId) : base.background,
    readingLevel: o.readingLevel === "original" || o.readingLevel === "simpler" || o.readingLevel === "simplest" ? o.readingLevel : base.readingLevel,
    ttsVoice: o.ttsVoice === null ? null : typeof o.ttsVoice === "string" && o.ttsVoice.length > 0 && o.ttsVoice.length < 128 ? o.ttsVoice : base.ttsVoice,
    ttsSpeed: num("ttsSpeed", 0.05),
  };
}

/** CSS for rendering text in the user's settings (quiz previews, reading view, saved page). */
export function settingsToStyle(s: ReaderSettings): Record<string, string | number> {
  const font = FONTS.find((f) => f.id === s.font) ?? FONTS[0];
  const bg = BACKGROUNDS[s.background];
  return {
    fontFamily: font.cssFamily,
    fontSize: `${s.fontSizePx}px`,
    letterSpacing: `${s.letterSpacingEm}em`,
    wordSpacing: `${s.wordSpacingEm}em`,
    lineHeight: s.lineSpacing,
    backgroundColor: bg.bg,
    color: bg.text,
  };
}

// ---------------------------------------------------------------------------
// Saved format (agreed with the Mac app)
// ---------------------------------------------------------------------------
// GET /api/settings returns this object as the whole response body, and PUT saves it.
// Every field must be present.

export type SavedReadingLevel = "simple" | "standard" | "advanced";

export interface SavedSettings {
  /** "system" | "serif" | "rounded" | "monospace", or the exact name of a font installed on the Mac */
  fontFamily: string;
  /** Points, about 14–28 */
  fontSize: number;
  /** Fraction of the font size: 0 = normal, 0.05 = 5% extra, 0.1 = wide */
  letterSpacing: number;
  /** Extra space between words, as a fraction of the font size: 0 = normal, 0.2 = wide */
  wordSpacing: number;
  /** Multiple of normal line height: 1.0 = tight, 1.4 = default, 2.0 = double */
  lineSpacing: number;
  /** macOS voice id, or null for the Mac's default voice */
  voice: string | null;
  /** 0.5 = half speed, 1.0 = normal, 2.0 = double */
  readingSpeed: number;
  /** The level Simplify rewrites to */
  readingLevel: SavedReadingLevel;
  /** "white" | "cream" | "dark" (colors in BACKGROUNDS) */
  background: BackgroundId;
}

/** The Mac app's own defaults. */
export const SAVED_DEFAULTS: SavedSettings = {
  fontFamily: "system",
  fontSize: 16,
  letterSpacing: 0,
  wordSpacing: 0,
  lineSpacing: 1.4,
  voice: null,
  readingSpeed: 1,
  readingLevel: "standard",
  background: "white",
};

const SAVED_LEVEL: Record<ReadingLevel, SavedReadingLevel> = {
  original: "standard",
  simpler: "simple",
  simplest: "simple",
};

/** Converts the quiz's settings into the saved format. */
export function toSavedSettings(s: ReaderSettings): SavedSettings {
  return {
    fontFamily: s.font,
    fontSize: s.fontSizePx,
    letterSpacing: s.letterSpacingEm,
    wordSpacing: s.wordSpacingEm,
    lineSpacing: s.lineSpacing,
    voice: s.ttsVoice,
    readingSpeed: s.ttsSpeed,
    readingLevel: SAVED_LEVEL[s.readingLevel],
    background: s.background,
  };
}

const SAVED_FONT_MAP: Record<string, string> = {
  system: "system-ui, sans-serif",
  serif: "Georgia, serif",
  monospace: "ui-monospace, monospace",
  rounded: "ui-rounded, sans-serif",
  "Atkinson Hyperlegible": "'Atkinson Hyperlegible', Verdana, sans-serif",
  Lexend: "'Lexend', Verdana, sans-serif",
  Verdana: "Verdana, sans-serif",
  OpenDyslexic: "'OpenDyslexic', Verdana, sans-serif",
  Arial: "Arial, sans-serif",
};

/** CSS typography properties only (no background/color) — suitable for applying globally to <body>. */
export function savedSettingsToTypographyStyle(s: SavedSettings): { fontFamily: string; letterSpacing: string; wordSpacing: string; lineHeight: number; } {
  return {
    fontFamily: SAVED_FONT_MAP[s.fontFamily] ?? s.fontFamily,
    letterSpacing: `${s.letterSpacing}em`,
    wordSpacing: `${s.wordSpacing}em`,
    lineHeight: s.lineSpacing,
  };
}

/** CSS for rendering text in the user's SavedSettings (saved page, layout body, settings preview). */
export function savedSettingsToStyle(s: SavedSettings): React.CSSProperties {
  const bg = BACKGROUNDS[s.background as BackgroundId] ?? BACKGROUNDS.white;
  return {
    fontFamily: SAVED_FONT_MAP[s.fontFamily] ?? s.fontFamily,
    fontSize: `${s.fontSize}px`,
    letterSpacing: `${s.letterSpacing}em`,
    wordSpacing: `${s.wordSpacing}em`,
    lineHeight: s.lineSpacing,
    backgroundColor: bg.bg,
    color: bg.text,
  };
}

/**
 * Turns any untrusted object into a complete SavedSettings: missing or bad fields get
 * the Mac's defaults, numbers are kept in range. Use in PUT /api/settings before saving.
 */
export function sanitizeSavedSettings(input: unknown): SavedSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = SAVED_DEFAULTS;
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? +clamp(v, min, max).toFixed(3) : fallback;
  return {
    fontFamily: typeof o.fontFamily === "string" && o.fontFamily.trim() && o.fontFamily.length < 100 ? o.fontFamily.trim() : d.fontFamily,
    fontSize: num(o.fontSize, 10, 36, d.fontSize),
    letterSpacing: num(o.letterSpacing, 0, 0.5, d.letterSpacing),
    wordSpacing: num(o.wordSpacing, 0, 0.5, d.wordSpacing),
    lineSpacing: num(o.lineSpacing, 1, 3, d.lineSpacing),
    voice: typeof o.voice === "string" && o.voice.length > 0 && o.voice.length < 128 ? o.voice : null,
    readingSpeed: num(o.readingSpeed, 0.5, 2, d.readingSpeed),
    readingLevel: o.readingLevel === "simple" || o.readingLevel === "standard" || o.readingLevel === "advanced" ? o.readingLevel : d.readingLevel,
    background: typeof o.background === "string" && o.background in BACKGROUNDS ? (o.background as BackgroundId) : d.background,
  };
}
