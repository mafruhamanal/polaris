// POST /api/speak — text-to-speech via ElevenLabs, returning audio plus word timestamps.
// Body: { text, voiceId? } (voiceId defaults to the user's saved voice).
// → { audio: base64 MP3, words: [{ offset, time }] } where `offset` is the word's start in
//   `text` (UTF-16 units, the same as Swift's NSString ranges) and `time` is seconds into the audio.
// 501 when ELEVENLABS_API_KEY isn't set, so the Mac falls back to its own voices.
import { getUserId } from "@/lib/getUserId";
import { db } from "@/lib/db";

const MAX_CHARS = 5_000;
const MODEL = "eleven_flash_v2_5";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
};

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "ElevenLabs isn't set up (ELEVENLABS_API_KEY)" }, { status: 501 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return Response.json({ error: "text is required" }, { status: 400 });
  if (text.length > MAX_CHARS) {
    return Response.json({ error: `text is longer than ${MAX_CHARS} characters` }, { status: 413 });
  }

  let voiceId: unknown = body?.voiceId;
  if (typeof voiceId !== "string" || !voiceId) {
    const rows = await db`SELECT voice FROM reader_settings WHERE user_id = ${userId}`;
    voiceId = rows[0]?.voice;
  }
  // ElevenLabs IDs are short alphanumeric strings (Apple ones look like com.apple.voice…).
  if (typeof voiceId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
    return Response.json({ error: "No ElevenLabs voice chosen" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(30_000),
    },
  ).catch(() => null);
  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "no response";
    return Response.json({ error: `ElevenLabs ${res?.status ?? ""}: ${detail.slice(0, 300)}` }, { status: 502 });
  }

  const data: { audio_base64: string; alignment?: Alignment } = await res.json();
  return Response.json({ audio: data.audio_base64, words: wordTimes(text, data.alignment) });
}

/** When each word of `text` starts in the audio, from ElevenLabs' per-character timings. */
function wordTimes(text: string, alignment?: Alignment): { offset: number; time: number }[] {
  const chars = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];

  // Start time for each UTF-16 position in the aligned text.
  const timeAt: number[] = [];
  chars.forEach((c, i) => {
    for (let k = 0; k < c.length; k++) timeAt.push(starts[i] ?? 0);
  });
  const aligned = chars.join("") === text;
  const total = starts.length ? starts[starts.length - 1] : 0;

  const words: { offset: number; time: number }[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const offset = m.index ?? 0;
    // If ElevenLabs changed the text, estimate from the word's position instead.
    const time = aligned ? timeAt[offset] ?? 0 : (offset / Math.max(1, text.length)) * total;
    words.push({ offset, time });
  }
  return words;
}
