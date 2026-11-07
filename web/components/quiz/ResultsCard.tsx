"use client";

import { useState } from "react";
import { type ReadingProfile, type SavedSettings, settingsToStyle } from "@/lib/settings";
import { editFields, currentOptionId, editSetting } from "@/lib/quiz/edit";
import { SAMPLE_TEXT } from "@/lib/quiz/questions";

type Props = {
  profile: ReadingProfile;
  settings: SavedSettings;
  summary: string;
  perSetting: Record<string, string>;
  onApply: (settings: SavedSettings) => Promise<void>;
  applying: boolean;
};

export default function ResultsCard({ profile: initial, settings: initialSettings, summary, perSetting, onApply, applying }: Props) {
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
        <h2 className="text-2xl font-bold">Here are your settings 🎉</h2>
        <p className="text-gray-600 leading-relaxed">{summary}</p>
      </div>

      {/* Live preview */}
      <div style={previewStyle} className="rounded-2xl p-7 shadow-sm">
        <p>{SAMPLE_TEXT}</p>
      </div>

      {/* Edit dropdowns */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {fields.map((field) => {
          const currentId = currentOptionId(field, profile.settings) ?? field.options[0]?.id;
          const evidence = perSetting[field.id];
          return (
            <div key={field.id} className="flex items-center gap-4 px-5 py-3">
              <label className="w-36 text-sm font-medium text-gray-700 shrink-0">{field.label}</label>
              <select
                value={currentId}
                onChange={(e) => handleEdit(field.id, e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {field.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              {evidence && <span className="text-xs text-gray-400 hidden lg:block w-48 shrink-0">{evidence}</span>}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onApply(settings)}
        disabled={applying}
        className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
      >
        {applying ? "Saving…" : "Apply to Polaris →"}
      </button>
    </div>
  );
}
