export async function GET() {
  if (!process.env.ELEVENLABS_API_KEY) {
    return Response.json({ voices: [] });
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return Response.json({ voices: [] });
  const data = await res.json();
  const voices = (data.voices ?? [])
    .filter((v: { category: string }) => v.category === "premade")
    .map((v: { voice_id: string; name: string; preview_url: string }) => ({
      voice_id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url,
    }));
  return Response.json({ voices });
}
