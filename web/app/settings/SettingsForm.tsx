"use client";

import { useState } from "react";
import { type SavedSettings } from "@/lib/settings";

export default function SettingsForm({ current }: { current: SavedSettings }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">Click to re-save current settings (tests the PUT endpoint).</p>
      <button
        onClick={save}
        disabled={status === "saving"}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
      >
        {status === "idle" && "Save settings"}
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved ✓"}
        {status === "error" && "Error — check console"}
      </button>
    </div>
  );
}
