"use client";

import { useState } from "react";
import { type ReadingProfile, type SavedSettings, settingsToStyle } from "@/lib/settings";
import { editFields, currentOptionId, editSetting } from "@/lib/quiz/edit";
import { SAMPLE_TEXT } from "@/lib/quiz/questions";

type Props = {
  profile: ReadingProfile;
  settings: SavedSettings;
  perSetting: Record<string, string>;
  onApply: (settings: SavedSettings) => Promise<void>;
  applying: boolean;
};

export default function ResultsCard({ profile: initial, settings: initialSettings, perSetting, onApply, applying }: Props) {
  const [profile, setProfile] = useState(initial);
  const [settings, setSettings] = useState(initialSettings);
  const fields = editFields();
  const previewStyle = settingsToStyle(profile.settings);

  function handleEdit(fieldId: string, optionId: string) {
    const { profile: next, settings: next2 } = editSetting(profile, fieldId as Parameters<typeof editSetting>[1], optionId);
    setProfile(next);
    setSettings(next2);
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold">Here are your settings 🎉</h2>
        <p className="text-xl text-star-white leading-relaxed">
          We will update your screen to match your choices. Your text will now be set up to be easy to read. You can change any setting at any time.
        </p>
      </div>

      {/* Live preview */}
      <div style={previewStyle} className="rounded-2xl p-7 shadow-sm">
        <p>{SAMPLE_TEXT}</p>
      </div>

      {/* Edit dropdowns */}
      <div className="bg-space-mid rounded-2xl border border-nebula-teal/10 shadow-sm divide-y divide-space-light">
        {fields.map((field) => {
          const currentId = currentOptionId(field, profile.settings) ?? field.options[0]?.id;
          const evidence = perSetting[field.id];
          return (
            <div key={field.id} className="flex items-center gap-4 px-6 py-4">
              <label className="w-52 text-xl font-medium text-star-white shrink-0">{field.label}</label>
              <select
                value={currentId}
                onChange={(e) => handleEdit(field.id, e.target.value)}
                className="border border-space-light rounded-lg px-4 py-3 text-xl flex-1 bg-space-light text-star-white focus:outline-none focus:ring-2 focus:ring-nebula-teal"
              >
                {field.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              {evidence && <span className="text-base text-star-white hidden lg:block w-48 shrink-0">{evidence}</span>}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onApply(settings)}
        disabled={applying}
        className="w-full bg-nebula-teal text-space-deep py-4 px-6 rounded-2xl font-semibold text-xl hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
      >
        {applying ? "Saving…" : "Apply to Polaris →"}
      </button>
    </div>
  );
}
