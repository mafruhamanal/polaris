// Reads text aloud in the browser, the same way the Mac app does (mac/Sources/Polaris/Reader/SpeechReader.swift):
//   1. /api/speech-prep says how to say it (URLs and citations dropped, abbreviations and acronyms spelled out);
//   2. the user's ElevenLabs voice reads it through /api/speak, with a timing for every character;
//   3. without an ElevenLabs voice (or if it fails) the browser's own voice reads it instead;
//   4. each word of the original text is reported as it is said, so the page can highlight it.
// Client-side only (uses Audio, speechSynthesis and fetch).

export type SpeechStatus = "idle" | "loading" | "playing" | "paused";
/** [start, end) of a word in the text, in UTF-16 units. */
export type WordRange = [number, number];

type Edit = { start: number; end: number; spoken: string };
type Callbacks = { onStatus: (s: SpeechStatus) => void; onWord: (r: WordRange | null) => void };

/** ElevenLabs voice IDs are short letters and digits; the Mac's voices look like com.apple.voice… */
export const isElevenLabsVoice = (id?: string | null): id is string => !!id && /^[A-Za-z0-9]{10,40}$/.test(id);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Where each word of `text` is. */
function wordsOf(text: string): WordRange[] {
  const out: WordRange[] = [];
  for (const s of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) {
    if (s.isWordLike) out.push([s.index, s.index + s.segment.length]);
  }
  return out;
}

async function fetchEdits(text: string): Promise<Edit[]> {
  try {
    const res = await fetch("/api/speech-prep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.edits) ? data.edits : [];
  } catch {
    return []; // read the text as it is
  }
}

async function fetchSpeech(text: string, voiceId: string): Promise<{ audio: string; charTimes: number[] }> {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  const data = await res.json();
  return { audio: String(data.audio), charTimes: Array.isArray(data.charTimes) ? data.charTimes : [] };
}

/** Only one thing speaks at a time. */
let current: SpeechPlayer | null = null;

export class SpeechPlayer {
  private words: WordRange[];
  // What is actually spoken, and where each word of `text` starts in it (words inside an edit all start where it does).
  private spoken: string;
  private spokenStarts: number[] = [];
  private skipped: boolean[] = [];
  private prepared = false;

  private index = 0;
  private status: SpeechStatus = "idle";
  /** Bumped by pause/stop so work that was still in flight gives up. */
  private job = 0;
  private elevenLabsFailed = false;

  private audio: HTMLAudioElement | null = null;
  private wordTimes: number[] = [];
  private raf = 0;

  private utterance: SpeechSynthesisUtterance | null = null;

  constructor(
    readonly text: string,
    private voice: string | null | undefined,
    private rate: number,
    private cb: Callbacks,
  ) {
    this.words = wordsOf(text);
    this.spoken = text;
    this.applyEdits([]);
  }

  // MARK: controls

  async play() {
    if (current && current !== this) current.stop();
    current = this;
    if (this.words.length === 0) return;
    const job = ++this.job;

    if (!this.prepared) {
      this.setStatus("loading");
      const edits = await fetchEdits(this.text);
      if (job !== this.job) return;
      this.applyEdits(edits);
      this.prepared = true;
    }

    // Paused audio just carries on.
    if (this.audio) {
      await this.audio.play().catch(() => {});
      this.setStatus("playing");
      this.cb.onWord(this.words[this.index]);
      this.tick();
      return;
    }

    if (isElevenLabsVoice(this.voice) && !this.elevenLabsFailed && this.spoken.trim()) {
      this.setStatus("loading");
      try {
        const speech = await fetchSpeech(this.spoken, this.voice);
        if (job !== this.job) return;
        await this.startAudio(speech, job);
        return;
      } catch {
        if (job !== this.job) return;
        this.elevenLabsFailed = true; // use the browser's voice for this text
      }
    }
    this.speakInBrowser(this.index);
  }

  pause() {
    this.job++;
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    if (this.utterance) {
      this.utterance = null;
      window.speechSynthesis?.cancel();
    }
    this.setStatus(this.audio || this.index > 0 ? "paused" : "idle");
  }

  /** Moves by `delta` words; keeps reading from there if it was reading. */
  step(delta: number) {
    if (this.words.length === 0) return;
    this.index = clamp(this.index + delta, 0, this.words.length - 1);
    if (this.audio && this.index < this.wordTimes.length) {
      this.audio.currentTime = this.wordTimes[this.index];
    } else if (this.utterance) {
      this.speakInBrowser(this.index);
      return;
    }
    // Paused or still loading: just show the word; playing starts from here.
    this.cb.onWord(this.words[this.index]);
  }

  stop() {
    this.job++;
    cancelAnimationFrame(this.raf);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.wordTimes = [];
    if (this.utterance) {
      this.utterance = null;
      window.speechSynthesis?.cancel();
    }
    this.index = 0;
    this.setStatus("idle");
    this.cb.onWord(null);
    if (current === this) current = null;
  }

  // MARK: spoken text

  /** Builds the spoken text from the edits, and where each word on screen starts in it. */
  private applyEdits(edits: Edit[]) {
    let out = "";
    let cursor = 0;
    const marks: { start: number; end: number; spokenStart: number; growth: number; skipped: boolean }[] = [];
    for (const e of [...edits].sort((a, b) => a.start - b.start)) {
      if (e.start < cursor || e.end <= e.start || e.end > this.text.length) continue;
      out += this.text.slice(cursor, e.start);
      const spokenStart = out.length;
      out += e.spoken;
      marks.push({
        start: e.start, end: e.end, spokenStart,
        growth: e.spoken.length - (e.end - e.start),
        skipped: e.spoken.trim() === "",
      });
      cursor = e.end;
    }
    out += this.text.slice(cursor);
    this.spoken = out;

    let m = 0;
    let shift = 0; // how much longer the spoken text is than the text before this word
    this.spokenStarts = [];
    this.skipped = [];
    for (const [start] of this.words) {
      while (m < marks.length && marks[m].end <= start) shift += marks[m++].growth;
      if (m < marks.length && marks[m].start <= start) {
        this.spokenStarts.push(marks[m].spokenStart);
        this.skipped.push(marks[m].skipped);
      } else {
        this.spokenStarts.push(start + shift);
        this.skipped.push(false);
      }
    }
  }

  // MARK: ElevenLabs

  private async startAudio(speech: { audio: string; charTimes: number[] }, job: number) {
    const audio = new Audio(`data:audio/mpeg;base64,${speech.audio}`);
    audio.playbackRate = clamp(this.rate, 0.5, 2);
    if (speech.charTimes.length === 0) {
      // No timings: spread the words evenly over the audio.
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("bad audio")), { once: true });
      });
      if (job !== this.job) return;
    }
    // Start of each word, never going backwards.
    let latest = 0;
    this.wordTimes = this.spokenStarts.map((start) => {
      const t = speech.charTimes.length
        ? speech.charTimes[clamp(start, 0, speech.charTimes.length - 1)]
        : (audio.duration * start) / Math.max(1, this.spoken.length);
      latest = Math.max(latest, t);
      return latest;
    });
    audio.currentTime = this.wordTimes[this.index] ?? 0;
    audio.onended = () => { if (this.audio === audio) this.stop(); };
    this.audio = audio;
    await audio.play(); // rejects if the browser blocks it; the caller then falls back
    if (job !== this.job) return;
    this.setStatus("playing");
    this.cb.onWord(this.words[this.index]);
    this.tick();
  }

  /** Highlights the word the audio has reached. */
  private tick = () => {
    const audio = this.audio;
    if (!audio || audio.paused) return;
    const t = audio.currentTime;
    let i = this.index;
    while (i + 1 < this.wordTimes.length && this.wordTimes[i + 1] <= t) i++;
    while (i > 0 && this.wordTimes[i] > t) i--;
    if (i !== this.index) {
      this.index = i;
      this.cb.onWord(this.words[i]);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  // MARK: the browser's voice

  private speakInBrowser(from: number) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return this.stop();
    this.utterance = null;
    synth.cancel();

    this.index = Math.min(from, this.words.length - 1);
    const offset = this.spokenStarts[this.index];
    const rest = this.spoken.slice(offset);
    if (!rest.trim()) return this.stop();

    const u = new SpeechSynthesisUtterance(rest);
    u.rate = clamp(this.rate, 0.5, 2);
    u.onboundary = (e) => {
      if (this.utterance === u && (!e.name || e.name === "word")) this.spoke(e.charIndex + offset);
    };
    u.onend = () => { if (this.utterance === u) this.stop(); };
    u.onerror = () => { if (this.utterance === u) this.stop(); };
    this.utterance = u;
    synth.speak(u);
    this.setStatus("playing");
    this.cb.onWord(this.words[this.index]);
  }

  /** The browser reached position `loc` of the spoken text: light up the matching word. */
  private spoke(loc: number) {
    let last = -1;
    for (let i = 0; i < this.words.length; i++) if (!this.skipped[i] && this.spokenStarts[i] <= loc) last = i;
    if (last < 0) return;
    // Several words inside one edit ("$1.2M" → "1.2 million dollars") light up as the first of them.
    const first = this.spokenStarts.findIndex((s, i) => !this.skipped[i] && s === this.spokenStarts[last]);
    this.index = first >= 0 ? first : last;
    this.cb.onWord(this.words[this.index]);
  }

  private setStatus(s: SpeechStatus) {
    if (s === this.status) return;
    this.status = s;
    this.cb.onStatus(s);
  }
}
