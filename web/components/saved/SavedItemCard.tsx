import type React from "react";
import MoveToCatalog from "./MoveToCatalog";

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
  catalogId?: string | null;
  catalogs?: { id: string; name: string }[];
};

const MODE_STYLE: Record<string, string> = {
  simplify: "bg-green-100 text-green-800",
  explain: "bg-blue-100 text-blue-800",
  dictation: "bg-purple-100 text-purple-800",
  note: "bg-amber-100 text-amber-800",
};

export default function SavedItemCard({ id, originalText, response, mode, sourceApp, sourceUrl, createdAt, readingStyle, title, catalogId, catalogs = [] }: Props) {
  const badge = MODE_STYLE[mode] ?? "bg-gray-100 text-gray-700";
  const isNote = mode === "note";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{mode}</span>
        {sourceApp && <span className="text-gray-400">{sourceApp}</span>}
        {sourceUrl && (
          <span className="text-gray-400 truncate max-w-xs">{sourceUrl}</span>
        )}
        <span className="ml-auto text-xs">{new Date(createdAt).toLocaleString()}</span>
        <MoveToCatalog itemId={id} catalogId={catalogId ?? null} catalogs={catalogs} />
      </div>

      {title && <h2 style={readingStyle} className="font-bold text-lg">{title}</h2>}

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{isNote ? "What you said" : "Original"}</p>
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{originalText}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{isNote ? "Note" : "Response"}</p>
        <p style={readingStyle} className="leading-relaxed whitespace-pre-line">{response.slice(0, isNote ? 1200 : 300)}{response.length > (isNote ? 1200 : 300) ? "…" : ""}</p>
      </div>
    </div>
  );
}
