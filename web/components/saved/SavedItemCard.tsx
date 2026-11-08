import type React from "react";
import DeleteSavedButton from "./DeleteSavedButton";
import ExpandableCard from "./ExpandableCard";
import { SpeechCard, ReadAloudButton, CardText } from "./SpeechCard";

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
  /** The reader's voice (an ElevenLabs ID) and speed for reading a response aloud. */
  voice?: string | null;
  readingSpeed?: number;
};

const MODE_STYLE: Record<string, string> = {
  simplify:  "bg-nebula-teal/20 text-nebula-teal",
  explain:   "bg-nebula-purple/20 text-nebula-purple",
  ask:       "bg-nebula-purple/20 text-nebula-purple",
  dictation: "bg-nebula-gold/20 text-nebula-gold",
  note:      "bg-nebula-gold/20 text-nebula-gold",
};

export default function SavedItemCard({ id, originalText, response, mode, sourceApp, sourceUrl, createdAt, readingStyle, title, conversation, voice, readingSpeed }: Props) {
  const badge = MODE_STYLE[mode] ?? "bg-space-light text-star-white";
  const isNote = mode === "note";
  const limit = isNote ? 1200 : 300;
  const isAsk = mode === "ask" && !!conversation && conversation.length > 0;

  // Everything on the card, in the order it is read aloud. `at` says which piece is which.
  const texts: string[] = [];
  const add = (t: string | null | undefined) => (t && t.trim() ? texts.push(t.trim()) - 1 : -1);
  const at = {
    title: add(title),
    original: add(originalText),
    response: isAsk ? -1 : add(response),
    turns: isAsk ? conversation!.map((t) => ({ question: add(t.question), answer: add(t.answer) })) : [],
  };

  const header = (
    <div className="flex items-center gap-4 text-3xl text-star-white flex-wrap">
      <span className={`px-5 py-1.5 rounded-full text-2xl font-semibold ${badge}`}>{mode}</span>
      {sourceApp && <span className="text-star-white">{sourceApp}</span>}
      {sourceUrl && (
        <span className="text-star-white truncate max-w-xs">{sourceUrl}</span>
      )}
      <span className="ml-auto text-2xl text-star-white">{new Date(createdAt).toLocaleString()}</span>
      <ReadAloudButton />
      <DeleteSavedButton itemId={id} label={isNote ? "note" : "saved response"} />
    </div>
  );

  const body = "text-2xl text-star-white leading-relaxed whitespace-pre-line";

  // An Ask session opens to the whole conversation when you click the card.
  if (isAsk) {
    const first = at.turns[0];
    return (
      <SpeechCard texts={texts} voice={voice} rate={readingSpeed}>
        <ExpandableCard
          header={header}
          messages={conversation!.length * 2}
          preview={
            <div className="space-y-4">
              <Labeled label="You asked"><CardText index={first.question} className={body} /></Labeled>
              <Labeled label="Answer"><CardText index={first.answer} clamp={300} boxed style={readingStyle} className={body} /></Labeled>
            </div>
          }
          full={
            <div className="space-y-6">
              {at.original >= 0 && (
                <Labeled label="Selected text"><CardText index={at.original} lineClamp="line-clamp-6" className={body} /></Labeled>
              )}
              {at.turns.map((t, i) => (
                <div key={i} className="space-y-4 border-t border-space-light pt-6">
                  <Labeled label="You asked"><CardText index={t.question} className={body} /></Labeled>
                  <Labeled label="Answer"><CardText index={t.answer} boxed style={readingStyle} className={body} /></Labeled>
                </div>
              ))}
            </div>
          }
        />
      </SpeechCard>
    );
  }

  return (
    <SpeechCard texts={texts} voice={voice} rate={readingSpeed}>
      <div className="bg-space-mid rounded-2xl border border-space-light shadow-sm p-8 space-y-6">
        {header}

        {at.title >= 0 && <CardText as="h2" index={at.title} style={readingStyle} className="font-bold text-3xl text-star-white" />}

        {at.original >= 0 && (
          <Labeled label={isNote ? "What you said" : "Original"}>
            <CardText index={at.original} lineClamp="line-clamp-2" className="text-2xl text-star-white leading-relaxed" />
          </Labeled>
        )}

        {at.response >= 0 && (
          <Labeled label={isNote ? "Note" : "Response"}>
            <CardText index={at.response} clamp={limit} boxed style={readingStyle} />
          </Labeled>
        )}
      </div>
    </SpeechCard>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-medium text-star-white uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}
