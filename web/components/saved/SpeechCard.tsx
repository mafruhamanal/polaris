"use client";

// Reads a whole saved card aloud. <SpeechCard> wraps the card with all of its text (title, original,
// response, or every question and answer); <ReadAloudButton> plays/pauses it; each <CardText> shows one
// piece of that text and highlights the word being said when it falls in that piece.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SpeechPlayer, type SpeechStatus, type WordRange } from "@/lib/speech";

type Value = {
  /** The pieces of text, in reading order, and where each starts in the one text that is read. */
  texts: string[];
  offsets: number[];
  status: SpeechStatus;
  word: WordRange | null;
  toggle: () => void;
  /** Reading has started (and isn't finished), so the card should show everything. */
  active: boolean;
};

const Ctx = createContext<Value | null>(null);

export function useSpeechCard(): Value | null {
  return useContext(Ctx);
}

export function SpeechCard({ texts, voice, rate = 1, children }: {
  texts: string[];
  voice?: string | null;
  rate?: number;
  children: React.ReactNode;
}) {
  const key = texts.join("\u0000");
  const { text, offsets } = useMemo(() => {
    const offsets: number[] = [];
    let text = "";
    texts.forEach((t, i) => {
      if (i > 0) text += "\n\n"; // a gap between pieces, so the voice pauses
      offsets.push(text.length);
      text += t;
    });
    return { text, offsets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [word, setWord] = useState<WordRange | null>(null);
  const player = useRef<SpeechPlayer | null>(null);

  // A new player for new text; stop reading when the card goes away.
  useEffect(() => {
    return () => {
      player.current?.stop();
      player.current = null;
    };
  }, [text, voice, rate]);

  function toggle() {
    if (!player.current) {
      player.current = new SpeechPlayer(text, voice, rate, { onStatus: setStatus, onWord: setWord });
    }
    if (status === "playing" || status === "loading") player.current.pause();
    else void player.current.play();
  }

  const value: Value = { texts, offsets, status, word, toggle, active: status !== "idle" };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The speaker button for the card. */
export function ReadAloudButton({ label = "Read this card aloud" }: { label?: string }) {
  const speech = useSpeechCard();
  if (!speech) return null;
  const busy = speech.status === "playing" || speech.status === "loading";
  return (
    <button
      type="button"
      onClick={speech.toggle}
      aria-label={busy ? "Pause reading" : label}
      title={busy ? "Pause" : label}
      className="p-2 rounded-full text-nebula-teal hover:bg-space-light transition-colors"
    >
      {busy ? (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
             className={speech.status === "loading" ? "animate-pulse" : undefined}>
          <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}

/** One piece of the card's text (`index` into the texts given to <SpeechCard>), highlighted while it is read. */
export function CardText({ index, clamp, lineClamp, as: Tag = "p", style, className }: {
  index: number;
  /** Show only this many characters until reading starts (reading shows all, so the highlight is visible). */
  clamp?: number;
  /** A CSS line-clamp class, dropped once reading starts for the same reason. */
  lineClamp?: string;
  as?: "p" | "h2";
  style?: React.CSSProperties;
  className?: string;
}) {
  const speech = useSpeechCard();
  const mark = useRef<HTMLElement | null>(null);
  const text = speech?.texts[index] ?? "";
  const start = speech?.offsets[index] ?? 0;
  const word = speech?.word;
  // The word being said, if it is inside this piece.
  const local: WordRange | null =
    speech?.active && word && word[0] >= start && word[1] <= start + text.length ? [word[0] - start, word[1] - start] : null;

  useEffect(() => {
    if (local) mark.current?.scrollIntoView({ block: "nearest" });
  }, [local?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = speech?.active ?? false;
  const shown = !active && clamp && text.length > clamp ? text.slice(0, clamp) + "…" : text;
  return (
    <Tag style={style} className={`${className ?? ""} ${active ? "" : lineClamp ?? ""}`}>
      {local ? (
        <>
          {text.slice(0, local[0])}
          <mark ref={mark} className="rounded px-0.5 bg-yellow-300 text-black">{text.slice(local[0], local[1])}</mark>
          {text.slice(local[1])}
        </>
      ) : (
        shown
      )}
    </Tag>
  );
}
