import { createServerFn } from "@tanstack/react-start";
import { deepgramContentType } from "@/lib/deepgram-content-type";
import { getServerEnv } from "@/lib/server-env";

const DEEPGRAM_LISTEN_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=en-US";

interface DeepgramListenResponse {
  results?: {
    channels?: { alternatives?: { transcript?: string }[] }[];
  };
  err_msg?: string;
  error?: string;
}

function getDeepgramKey(): string {
  const key = getServerEnv("DEEPGRAM_API_KEY", "VITE_DEEPGRAM_API_KEY");
  if (!key) throw new Error("Deepgram API key is not configured");
  return key;
}

function extractPayload(ctx: unknown): { base64: string; mimeType: string } {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") {
      const { base64, mimeType } = data as { base64?: string; mimeType?: string };
      if (typeof base64 === "string" && base64.length > 0) {
        return { base64, mimeType: mimeType ?? "audio/webm" };
      }
    }
  }
  throw new Error("Invalid audio payload");
}

export const transcribeAudioServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ transcript: string }> => {
    const { base64, mimeType } = extractPayload(ctx);
    const apiKey = getDeepgramKey();

    const contentType = deepgramContentType(mimeType);

    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const response = await fetch(DEEPGRAM_LISTEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      body: binary,
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await response.json()) as DeepgramListenResponse;

    if (!response.ok) {
      const message = data.err_msg ?? data.error ?? `Deepgram HTTP ${response.status}`;
      throw new Error(message);
    }

    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
    return { transcript };
  },
);
