import type React from "react";
import DeleteSavedButton from "./DeleteSavedButton";

type Props = {
  id: string;
  originalText: string;
  response: string;
  mode: string;
  sourceApp?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  readingStyle?: React.CSSProperties;
  title?: string | null;
};

const MODE_STYLE: Record<string, string> = {
  simplify:  "bg-nebula-teal/20 text-nebula-teal",
  explain:   "bg-nebula-purple/20 text-nebula-purple",
  dictation: "bg-nebula-gold/20 text-nebula-gold",
  note:      "bg-nebula-gold/20 text-nebula-gold",
};

export default function SavedItemCard({ id, originalText, response, mode, sourceApp, sourceUrl, createdAt, readingStyle, title }: Props) {
  const badge = MODE_STYLE[mode] ?? "bg-space-light text-star-white";
  const isNote = mode === "note";
  const limit = isNote ? 1200 : 300;

  return (
    <div className="bg-space-mid rounded-2xl border border-space-light shadow-sm p-8 space-y-6">
      <div className="flex items-center gap-4 text-3xl text-star-white flex-wrap">
        <span className={`px-5 py-1.5 rounded-full text-2xl font-semibold ${badge}`}>{mode}</span>
        {sourceApp && <span className="text-star-white">{sourceApp}</span>}
        {sourceUrl && (
          <span className="text-star-white truncate max-w-xs">{sourceUrl}</span>
        )}
        <span className="ml-auto text-2xl text-star-white">{new Date(createdAt).toLocaleString()}</span>
        <DeleteSavedButton itemId={id} label={isNote ? "note" : "saved response"} />
      </div>

      {title && <h2 style={readingStyle} className="font-bold text-3xl text-star-white">{title}</h2>}

      <div className="space-y-2">
        <p className="text-base font-medium text-star-white uppercase tracking-wide">{isNote ? "What you said" : "Original"}</p>
        <p className="text-2xl text-star-white leading-relaxed line-clamp-2">{originalText}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-star-white uppercase tracking-wide">{isNote ? "Note" : "Response"}</p>
        <p style={readingStyle} className="leading-relaxed whitespace-pre-line">{response.slice(0, limit)}{response.length > limit ? "…" : ""}</p>
      </div>
    </div>
  );
}
