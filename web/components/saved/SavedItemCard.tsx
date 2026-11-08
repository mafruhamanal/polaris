import type React from "react";
import DeleteSavedButton from "./DeleteSavedButton";
import ExpandableCard from "./ExpandableCard";

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
  /** An Ask session: every question and answer, in order. */
  conversation?: { question: string; answer: string }[] | null;
};

const MODE_STYLE: Record<string, string> = {
  simplify:  "bg-nebula-teal/20 text-nebula-teal",
  explain:   "bg-nebula-purple/20 text-nebula-purple",
  ask:       "bg-nebula-purple/20 text-nebula-purple",
  dictation: "bg-nebula-gold/20 text-nebula-gold",
  note:      "bg-nebula-gold/20 text-nebula-gold",
};

export default function SavedItemCard({ id, originalText, response, mode, sourceApp, sourceUrl, createdAt, readingStyle, title, conversation }: Props) {
  const badge = MODE_STYLE[mode] ?? "bg-space-light text-star-white";
  const isNote = mode === "note";
  const limit = isNote ? 1200 : 300;

  const header = (
    <div className="flex items-center gap-4 text-3xl text-star-white flex-wrap">
      <span className={`px-5 py-1.5 rounded-full text-2xl font-semibold ${badge}`}>{mode}</span>
      {sourceApp && <span className="text-star-white">{sourceApp}</span>}
      {sourceUrl && (
        <span className="text-star-white truncate max-w-xs">{sourceUrl}</span>
      )}
      <span className="ml-auto text-2xl text-star-white">{new Date(createdAt).toLocaleString()}</span>
      <DeleteSavedButton itemId={id} label={isNote ? "note" : "saved response"} />
    </div>
  );

  // An Ask session opens to the whole conversation when you click the card.
  if (mode === "ask" && conversation && conversation.length > 0) {
    const [first] = conversation;
    return (
      <ExpandableCard
        header={header}
        messages={conversation.length * 2}
        preview={
          <div className="space-y-4">
            <Bubble label="You asked" text={first.question} />
            <Bubble label="Answer" text={first.answer.slice(0, 300) + (first.answer.length > 300 ? "…" : "")} style={readingStyle} />
          </div>
        }
        full={
          <div className="space-y-6">
            {originalText.trim() && (
              <div className="space-y-2">
                <p className="text-base font-medium text-star-white uppercase tracking-wide">Selected text</p>
                <p className="text-2xl text-star-white leading-relaxed whitespace-pre-line line-clamp-6">{originalText}</p>
              </div>
            )}
            {conversation.map((t, i) => (
              <div key={i} className="space-y-4 border-t border-space-light pt-6">
                <Bubble label="You asked" text={t.question} />
                <Bubble label="Answer" text={t.answer} style={readingStyle} />
              </div>
            ))}
          </div>
        }
      />
    );
  }

  return (
    <div className="bg-space-mid rounded-2xl border border-space-light shadow-sm p-8 space-y-6">
      {header}

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

function Bubble({ label, text, style }: { label: string; text: string; style?: React.CSSProperties }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-medium text-star-white uppercase tracking-wide">{label}</p>
      <p style={style} className="text-2xl text-star-white leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}
