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
  /** Previous (-1) or next (+1) word. */
  step: (delta: number) => void;
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

  function step(delta: number) {
    player.current?.step(delta);
  }

  const value: Value = { texts, offsets, status, word, toggle, step, active: status !== "idle" };
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
export function CardText({ index, clamp, lineClamp, boxed, as: Tag = "p", style, className }: {
  index: number;
  /** Show only this many characters until reading starts (reading shows all, so the highlight is visible). */
  clamp?: number;
  /** A CSS line-clamp class, dropped once reading starts for the same reason. */
  lineClamp?: string;
  /** Draw it as the reading-settings preview box (the reader's colors, font and padding) using `style`. */
  boxed?: boolean;
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
  const content = local ? (
    <>
      {text.slice(0, local[0])}
      <mark ref={mark} className="rounded px-0.5 bg-yellow-300 text-black">{text.slice(local[0], local[1])}</mark>
      {text.slice(local[1])}
    </>
  ) : (
    shown
  );

  if (boxed) {
    return (
      <div style={{ zoom: 1.5 }}>
        <div style={{ ...style, borderRadius: "12px", padding: "16px" }} className="whitespace-pre-line">{content}</div>
      </div>
    );
  }
  return (
    <Tag style={style} className={`${className ?? ""} ${active ? "" : lineClamp ?? ""}`}>
      {content}
    </Tag>
  );
}

const iconProps = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;

/** Previous word, play/pause and next word, shown while the card is being read (like the Mac reader). */
export function ReadingControls() {
  const speech = useSpeechCard();
  const loading = speech?.status === "loading";
  const [almostReady, setAlmostReady] = useState(false);

  // "Preparing voice…", then "Almost ready…" if it takes a while.
  useEffect(() => {
    setAlmostReady(false);
    if (!loading) return;
    const t = setTimeout(() => setAlmostReady(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  if (!speech?.active) return null;
  const playing = speech.status === "playing";
  const button = "p-2 rounded-full text-nebula-teal hover:bg-space-light transition-colors";

  return (
    <div className="sticky bottom-4 flex items-center justify-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 rounded-full border border-space-light bg-space-mid/95 px-4 py-1 shadow-lg backdrop-blur">
        <button type="button" onClick={() => speech.step(-1)} className={button} aria-label="Previous word" title="Previous word">
          <svg {...iconProps}><path d="M11 6v12l-8-6zM21 6v12l-8-6z" /></svg>
        </button>
        <button type="button" onClick={speech.toggle} className={button}
                aria-label={playing || loading ? "Pause" : "Play"} title={loading ? "Cancel" : playing ? "Pause" : "Play"}>
          {loading ? (
            <svg {...iconProps} className="animate-spin" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
          ) : playing ? (
            <svg {...iconProps}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg {...iconProps}><path d="M7 4v16l13-8z" /></svg>
          )}
        </button>
        <button type="button" onClick={() => speech.step(1)} className={button} aria-label="Next word" title="Next word">
          <svg {...iconProps}><path d="M13 6v12l8-6zM3 6v12l8-6z" /></svg>
        </button>
      </div>
      {loading && <span className="text-xl text-star-white" role="status">{almostReady ? "Almost ready…" : "Preparing voice…"}</span>}
    </div>
  );
}
