import type React from "react";

type Props = {
  id: string;
  originalText: string;
  response: string;
  mode: string;
  sourceApp?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  readingStyle?: React.CSSProperties;
};

const MODE_STYLE: Record<string, string> = {
  simplify:  "bg-nebula-teal/20 text-nebula-teal",
  explain:   "bg-nebula-purple/20 text-nebula-purple",
  dictation: "bg-nebula-gold/20 text-nebula-gold",
};

export default function SavedItemCard({ originalText, response, mode, sourceApp, sourceUrl, createdAt, readingStyle }: Props) {
  const badge = MODE_STYLE[mode] ?? "bg-space-light text-star-dim";

  return (
    <div className="bg-space-mid rounded-2xl border border-space-light shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm text-star-dim flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{mode}</span>
        {sourceApp && <span className="text-star-dim">{sourceApp}</span>}
        {sourceUrl && (
          <span className="text-star-dim truncate max-w-xs">{sourceUrl}</span>
        )}
        <span className="ml-auto text-xs text-star-dim">{new Date(createdAt).toLocaleString()}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-star-dim uppercase tracking-wide">Original</p>
        <p className="text-sm text-star-white leading-relaxed line-clamp-2">{originalText}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-star-dim uppercase tracking-wide">Response</p>
        <p style={readingStyle} className="leading-relaxed">{response.slice(0, 300)}{response.length > 300 ? "…" : ""}</p>
      </div>
    </div>
  );
}
