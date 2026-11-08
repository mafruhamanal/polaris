"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  type SavedSettings, type BackgroundId,
  BACKGROUNDS, sanitizeSavedSettings, savedSettingsToTypographyStyle,
} from "@/lib/settings";
import { SAMPLE_TEXT } from "@/lib/quiz/questions";

type ElevenLabsVoice = { voice_id: string; name: string; preview_url: string };

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

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  simple:   "Text is rewritten with short sentences and everyday words — easiest to read",
  standard: "Text is lightly simplified with clearer sentences — balanced and readable",
  advanced: "Text is shown as-is, with no changes — closest to the original source",
};

export default function SettingsForm({ settings: initial }: { settings: SavedSettings }) {
  const [s, setS] = useState<SavedSettings>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => setVoices(d.voices ?? []));
  }, []);


  function set<K extends keyof SavedSettings>(key: K, value: SavedSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  function playVoice(previewUrl: string) {
    audioRef.current?.pause();
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.play();
  }

  function playSpeedPreview() {
    audioRef.current?.pause();
    const preview = voices.find((v) => v.voice_id === s.voice)?.preview_url ?? voices[0]?.preview_url;
    if (!preview) return;
    const audio = new Audio(preview);
    audio.playbackRate = s.readingSpeed;
    audioRef.current = audio;
    audio.play();
  }

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sanitizeSavedSettings(s)),
    });
    if (res.ok) {
      const typography = savedSettingsToTypographyStyle(s);
      document.documentElement.style.fontSize = `${s.fontSize}px`;
      document.documentElement.style.setProperty('--ui-line-height', String(typography.lineHeight));
      document.body.style.fontFamily = typography.fontFamily;
      document.body.style.letterSpacing = typography.letterSpacing;
      document.body.style.wordSpacing = typography.wordSpacing;
    }
    setStatus(res.ok ? "saved" : "error");
  }

  // Live typography for preview — no explicit fontSize so it inherits from <html>
  // and renders at the same scale as the rest of the UI (zoom: 1.5 cancels the page's zoom: 2/3).
  const previewStyle: React.CSSProperties = {
    fontFamily: savedSettingsToTypographyStyle(s).fontFamily,
    letterSpacing: `${s.letterSpacing}em`,
    wordSpacing: `${s.wordSpacing}em`,
    lineHeight: s.lineSpacing,
  };

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div style={{ zoom: 1.5 }}>
        <p className="text-xl font-medium text-star-white uppercase tracking-wide mb-3">Preview</p>
        <div style={previewStyle} className="rounded-2xl p-8 bg-space-mid border border-space-light text-star-white transition-all duration-300">
          <p>{SAMPLE_TEXT}</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ zoom: 1.5 }}>
      <div className="bg-space-mid rounded-2xl border border-nebula-teal/10 shadow-sm divide-y divide-space-light">

        {/* Font */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Font</label>
          <select value={s.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}
            className="border border-space-light rounded-lg px-4 py-3 text-xl flex-1 bg-space-light text-star-white focus:outline-none focus:ring-2 focus:ring-nebula-teal">
            {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Text size</label>
          <input type="range" min={10} max={36} step={1} value={s.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value))}
            className="flex-1 accent-nebula-teal" />
          <span className="text-xl text-star-white w-20 text-right">{s.fontSize}px</span>
        </div>

        {/* Letter spacing */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Letter spacing</label>
          <input type="range" min={0} max={0.3} step={0.01} value={s.letterSpacing}
            onChange={(e) => set("letterSpacing", Number(e.target.value))}
            className="flex-1 accent-nebula-teal" />
          <span className="text-xl text-star-white w-16 text-right">{s.letterSpacing.toFixed(2)}</span>
        </div>

        {/* Line spacing */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Line spacing</label>
          <input type="range" min={1} max={2.5} step={0.05} value={s.lineSpacing}
            onChange={(e) => set("lineSpacing", Number(e.target.value))}
            className="flex-1 accent-nebula-teal" />
          <span className="text-xl text-star-white w-16 text-right">{s.lineSpacing.toFixed(1)}</span>
        </div>

        {/* Background */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Background</label>
          <div className="flex gap-3">
            {(Object.entries(BACKGROUNDS) as [BackgroundId, { label: string; bg: string; text: string }][]).map(([id, val]) => (
              <button key={id} onClick={() => set("background", id)}
                title={val.label}
                style={{ backgroundColor: val.bg, color: val.text, border: s.background === id ? "2px solid #64ffda" : "2px solid transparent" }}
                className="w-14 h-14 rounded-lg text-base font-bold transition-all">
                A
              </button>
            ))}
          </div>
        </div>

        {/* Voice */}
        <div className="px-6 py-5 space-y-3">
          <label className="block text-xl font-medium text-star-white">Voice</label>
          {voices.length === 0 ? (
            <p className="text-xl text-star-white">Loading voices…</p>
          ) : (
            <div className="space-y-3">
              <div
                onClick={() => set("voice", null)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  s.voice === null ? "border-nebula-teal bg-nebula-teal/10" : "border-space-light hover:border-nebula-teal/40"
                }`}
              >
                <span className={`flex-1 text-xl font-medium ${s.voice === null ? "text-nebula-teal" : "text-star-white"}`}>No voice (Mac default)</span>
              </div>
              {voices.map((v) => (
                <div
                  key={v.voice_id}
                  onClick={() => set("voice", v.voice_id)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    s.voice === v.voice_id ? "border-nebula-teal bg-nebula-teal/10" : "border-space-light hover:border-nebula-teal/40"
                  }`}
                >
                  <span className={`flex-1 text-xl font-medium ${s.voice === v.voice_id ? "text-nebula-teal" : "text-star-white"}`}>{v.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); playVoice(v.preview_url); }}
                    className="text-xl text-nebula-teal hover:text-star-white px-5 py-2 rounded-lg bg-nebula-teal/10 hover:bg-nebula-teal/20 transition-colors"
                  >
                    ▶ Play
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reading speed */}
        <div className="flex items-center gap-6 px-6 py-5">
          <label className="w-52 text-xl font-medium text-star-white shrink-0">Reading speed</label>
          <input type="range" min={0.5} max={2} step={0.05} value={s.readingSpeed}
            onChange={(e) => set("readingSpeed", Number(e.target.value))}
            onPointerUp={voices.length > 0 ? playSpeedPreview : undefined}
            className="flex-1 accent-nebula-teal" />
          <span className="text-xl text-star-white w-16 text-right">{s.readingSpeed.toFixed(2)}×</span>
        </div>

        {/* Reading level */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-6">
            <label className="w-52 text-xl font-medium text-star-white shrink-0">Reading level</label>
            <div className="flex gap-3">
              {LEVEL_OPTIONS.map((l) => (
                <button key={l.id} onClick={() => set("readingLevel", l.id as SavedSettings["readingLevel"])}
                  className={`px-6 py-3 rounded-lg text-xl font-medium border-2 transition-all ${
                    s.readingLevel === l.id ? "border-nebula-teal bg-nebula-teal/10 text-nebula-teal" : "border-space-light text-star-white hover:border-nebula-teal/40 hover:text-star-white"
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xl text-star-white pl-52">{LEVEL_DESCRIPTIONS[s.readingLevel]}</p>
        </div>
      </div>

      <button onClick={save} disabled={status === "saving"}
        className="w-full bg-nebula-teal text-space-deep py-5 rounded-xl text-2xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
        {status === "idle" && "Save settings"}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved ✓"}
        {status === "error" && "Error — try again"}
      </button>
      </div>
    </div>
  );
}