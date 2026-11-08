// Gemini client: calls the API and streams text back.
//
// Server-only: reads GEMINI_API_KEY from the environment. Never import this from a
// client component, or the key ends up in the browser bundle.
//
//   generateJSON  — one call, returns parsed JSON that matches a schema (quiz features)
//   streamText    — yields text chunks as they arrive (simplify / explain in the Mac popup)

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 20_000;

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Gemini's response schema format (an OpenAPI subset). Types are uppercase:
 * { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] }
 */
export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  nullable?: boolean;
};

interface CallOptions {
  system: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

function body(opts: CallOptions, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      ...extra,
    },
  });
}

async function post(path: string, payload: string, timeoutMs: number): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(`Gemini ${res.status}: ${text.slice(0, 500)}`, res.status);
  }
  return res;
}

type Candidate = { content?: { parts?: { text?: string }[] }; finishReason?: string };
const textOf = (data: { candidates?: Candidate[] }) =>
  data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

/** Calls Gemini in JSON mode and returns the parsed result. Throws GeminiError on failure. */
export async function generateJSON<T>(opts: CallOptions & { schema: GeminiSchema }): Promise<T> {
  const model = opts.model ?? DEFAULT_MODEL;
  const res = await post(
    `${model}:generateContent`,
    body(opts, { responseMimeType: "application/json", responseSchema: opts.schema }),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const data = await res.json();
  const text = textOf(data);
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "empty response";
    throw new GeminiError(`Gemini returned no text (${reason})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

/** Streams plain text from Gemini as it's generated. */
export async function* streamText(opts: CallOptions): AsyncGenerator<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const res = await post(`${model}:streamGenerateContent?alt=sse`, body(opts), opts.timeoutMs ?? 60_000);
  if (!res.body) throw new GeminiError("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const chunk = textOf(JSON.parse(payload));
        if (chunk) yield chunk;
      } catch {
        // ignore partial / keep-alive lines
      }
    }
  }
}

/** Wraps streamText as a plain-text streaming Response for a Next.js route. */
export function streamResponse(opts: CallOptions): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamText(opts)) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error] ${e instanceof Error ? e.message : String(e)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
