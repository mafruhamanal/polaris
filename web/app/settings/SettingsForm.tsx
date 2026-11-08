"use client";

import { useState } from "react";
import {
  type SavedSettings, type BackgroundId,
  BACKGROUNDS, VOICES, sanitizeSavedSettings, savedSettingsToStyle,
} from "@/lib/settings";
import { SAMPLE_TEXT } from "@/lib/quiz/questions";

const FONT_OPTIONS = [
  { id: "system", label: "System default" },
  { id: "Atkinson Hyperlegible", label: "Atkinson Hyperlegible" },
  { id: "Lexend", label: "Lexend" },
  { id: "Verdana", label: "Verdana" },
  { id: "serif", label: "Serif" },
  { id: "monospace", label: "Monospace" },
];

const LEVEL_OPTIONS = [
  { id: "simple", label: "Simple" },
  { id: "standard", label: "Standard" },
  { id: "advanced", label: "Advanced" },
];


export default function SettingsForm({ settings: initial }: { settings: SavedSettings }) {
  const [s, setS] = useState<SavedSettings>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set<K extends keyof SavedSettings>(key: K, value: SavedSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sanitizeSavedSettings(s)),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  const style = savedSettingsToStyle(s);

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Preview</p>
        <div style={style} className="rounded-2xl p-6 shadow-sm transition-all duration-300">
          <p>{SAMPLE_TEXT}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">

        {/* Font */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Font</label>
          <select value={s.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Text size</label>
          <input type="range" min={12} max={32} step={1} value={s.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value))}
            className="flex-1 accent-blue-600" />
          <span className="text-sm text-gray-500 w-10 text-right">{s.fontSize}px</span>
        </div>

        {/* Letter spacing */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Letter spacing</label>
          <input type="range" min={0} max={0.3} step={0.01} value={s.letterSpacing}
            onChange={(e) => set("letterSpacing", Number(e.target.value))}
            className="flex-1 accent-blue-600" />
          <span className="text-sm text-gray-500 w-10 text-right">{s.letterSpacing.toFixed(2)}</span>
        </div>

        {/* Line spacing */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Line spacing</label>
          <input type="range" min={1} max={2.5} step={0.05} value={s.lineSpacing}
            onChange={(e) => set("lineSpacing", Number(e.target.value))}
            className="flex-1 accent-blue-600" />
          <span className="text-sm text-gray-500 w-10 text-right">{s.lineSpacing.toFixed(1)}</span>
        </div>

        {/* Background */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Background</label>
          <div className="flex gap-2">
            {(Object.entries(BACKGROUNDS) as [BackgroundId, { label: string; bg: string; text: string }][]).map(([id, val]) => (
              <button key={id} onClick={() => set("background", id)}
                title={val.label}
                style={{ backgroundColor: val.bg, color: val.text, border: s.background === id ? "2px solid #2563EB" : "2px solid transparent" }}
                className="w-8 h-8 rounded-lg text-xs font-bold transition-all">
                A
              </button>
            ))}
          </div>
        </div>

        {/* Voice */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Voice</label>
          <select value={s.voice ?? ""} onChange={(e) => set("voice", e.target.value || null)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {VOICES.map((v) => <option key={v.id ?? "default"} value={v.id ?? ""}>{v.label}</option>)}
          </select>
        </div>

        {/* Reading speed */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Reading speed</label>
          <input type="range" min={0.5} max={2} step={0.05} value={s.readingSpeed}
            onChange={(e) => set("readingSpeed", Number(e.target.value))}
            className="flex-1 accent-blue-600" />
          <span className="text-sm text-gray-500 w-10 text-right">{s.readingSpeed.toFixed(2)}×</span>
        </div>

        {/* Reading level */}
        <div className="flex items-center gap-4 px-5 py-3">
          <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Reading level</label>
          <div className="flex gap-2">
            {LEVEL_OPTIONS.map((l) => (
              <button key={l.id} onClick={() => set("readingLevel", l.id as SavedSettings["readingLevel"])}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  s.readingLevel === l.id ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 hover:border-gray-300"
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={status === "saving"}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
        {status === "idle" && "Save settings"}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved ✓"}
        {status === "error" && "Error — try again"}
      </button>
    </div>
  );
}
