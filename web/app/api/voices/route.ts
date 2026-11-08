type ElevenLabsVoice = { voice_id: string; name: string; preview_url: string };

const CURATED_IDS = [
  "EXAVITQu4vr4xnSDxMaL", // Sarah  — female, mature, reassuring
  "JBFqnCBsd6RMkjVDRZzb", // George — male, warm storyteller
  "Xb7hH8MSUJpSbSDYk0k2", // Alice  — female, clear, educational
  "nPczCjzI2devNBz1zQrb", // Brian  — male, deep, comforting
  "SAz9YHcvj6GT2YYXdXww", // River  — neutral, relaxed, informative
];

export async function GET() {
  if (!process.env.ELEVENLABS_API_KEY) {
    return Response.json({ voices: [] });
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ voices: [] });
  const data = await res.json();
  const all: ElevenLabsVoice[] = (data.voices ?? [])
    .filter((v: ElevenLabsVoice) => !!v.preview_url)
    .map((v: ElevenLabsVoice) => ({
      voice_id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url,
    }));
  const voices = CURATED_IDS
    .map((id) => all.find((v) => v.voice_id === id))
    .filter((v): v is ElevenLabsVoice => v !== undefined);
  return Response.json({ voices });
}
