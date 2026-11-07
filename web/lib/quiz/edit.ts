// Quick edits on the results screen: one dropdown per setting, using the same options
// the quiz compared. For bigger changes, the person retakes the quiz.
//
//   const fields = editFields();                       // render one <select> per field
//   value={currentOptionId(field, profile.settings)}   // which option is selected now
//   onChange → const { profile, settings } = editSetting(profile, field.id, optionId)
//              settings is the saved format → PUT /api/settings

import { BACKGROUNDS, type ReaderSettings, type ReadingProfile, type SavedSettings, sanitizeSettings, toSavedSettings, VOICES } from "../settings";
import { buildRounds, type RoundId, SPEED_CHOICES } from "./questions";
import { EVIDENCE_KEY } from "./scoring";

export type EditFieldId = RoundId | "voice" | "speed";

export interface EditOption {
  id: string;
  /** Text for the dropdown, e.g. "26px (extra-large)" */
  label: string;
  /** The settings this option sets. */
  patch: Partial<ReaderSettings>;
}

export interface EditField {
  id: EditFieldId;
  /** Text next to the dropdown, e.g. "Text size" */
  label: string;
  options: EditOption[];
}

const FIELD_LABEL: Record<EditFieldId, string> = {
  font: "Font",
  background: "Background",
  size: "Text size",
  spacing: "Letter spacing",
  lineSpacing: "Line spacing",
  voice: "Voice",
  speed: "Reading speed",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Dropdown text for a quiz option: the exact value first where it's a number. */
function optionLabel(round: RoundId, label: string, patch: Partial<ReaderSettings>): string {
  switch (round) {
    case "size":
      return `${patch.fontSizePx}px (${label.replace(/ text$/, "")})`;
    case "lineSpacing":
      return `${cap(label.replace(/ line spacing$/, ""))} (${patch.lineSpacing})`;
    case "background":
      return BACKGROUNDS[patch.background!].label;
    default:
      return cap(label);
  }
}

/** Number to sort options by, so dropdowns go small → large. */
const sortKey = (p: Partial<ReaderSettings>) => p.fontSizePx ?? p.lineSpacing ?? p.letterSpacingEm ?? 0;

/** The fields to show on the results screen, in order, with their dropdown options. */
export function editFields(): EditField[] {
  const rounds: EditField[] = buildRounds().map((r) => {
    const options = r.options.map((o) => ({ id: o.id, label: optionLabel(r.id, o.label, o.patch), patch: o.patch }));
    if (r.id === "size" || r.id === "lineSpacing" || r.id === "spacing") options.sort((a, b) => sortKey(a.patch) - sortKey(b.patch));
    return { id: r.id, label: FIELD_LABEL[r.id], options };
  });
  return [
    ...rounds,
    {
      id: "voice",
      label: FIELD_LABEL.voice,
      options: VOICES.map((v) => ({ id: v.id ?? "default", label: v.label, patch: { ttsVoice: v.id } })),
    },
    {
      id: "speed",
      label: FIELD_LABEL.speed,
      options: SPEED_CHOICES.map((x) => ({ id: String(x), label: x === 1 ? "1x (normal)" : `${x}x`, patch: { ttsSpeed: x } })),
    },
  ];
}

/** The option that matches the current settings (the dropdown's selected value), if any. */
export function currentOptionId(field: EditField, settings: ReaderSettings): string | undefined {
  return field.options.find((o) =>
    (Object.keys(o.patch) as (keyof ReaderSettings)[]).every((k) => settings[k] === o.patch[k]),
  )?.id;
}

const EDIT_EVIDENCE_KEY: Record<EditFieldId, keyof ReaderSettings> = { ...EVIDENCE_KEY, voice: "ttsVoice", speed: "ttsSpeed" };

/**
 * Applies one dropdown change. Returns the updated profile (for the results screen)
 * and the saved-format settings (for PUT /api/settings). Unknown ids change nothing.
 */
export function editSetting(
  profile: ReadingProfile,
  fieldId: EditFieldId,
  optionId: string,
): { profile: ReadingProfile; settings: SavedSettings } {
  const field = editFields().find((f) => f.id === fieldId);
  const option = field?.options.find((o) => o.id === optionId);
  if (!option) return { profile, settings: toSavedSettings(profile.settings) };

  const settings = sanitizeSettings({ ...profile.settings, ...option.patch });
  const evidence = { ...profile.evidence, [EDIT_EVIDENCE_KEY[fieldId]]: "You changed this." };
  const next = { ...profile, settings, evidence };
  return { profile: next, settings: toSavedSettings(settings) };
}
