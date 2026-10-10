import { deepgramContentType } from "@/lib/deepgram-content-type";

const DEEPGRAM_LISTEN_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=en-US";

interface DeepgramListenResponse {
  results?: {
    channels?: {
      alternatives?: { transcript?: string; confidence?: number }[];
    }[];
  };
  err_msg?: string;
  error?: string;
}

export function getDeepgramApiKey(): string {
  const key = import.meta.env.VITE_DEEPGRAM_API_KEY?.trim();
  if (!key) {
    throw new Error("VITE_DEEPGRAM_API_KEY is not configured");
  }
  return key;
}

export function pickMediaRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to encode audio"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read audio blob"));
    reader.readAsDataURL(blob);
  });
}

function parseTranscript(data: DeepgramListenResponse): string {
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}

async function transcribeWithClient(audioBlob: Blob, mimeType: string): Promise<string> {
  const apiKey = getDeepgramApiKey();
  const contentType = deepgramContentType(mimeType);

  const response = await fetch(DEEPGRAM_LISTEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType,
    },
    body: audioBlob,
  });

  const data = (await response.json()) as DeepgramListenResponse;

  if (!response.ok) {
    const message = data.err_msg ?? data.error ?? `Deepgram HTTP ${response.status}`;
    throw new Error(message);
  }

  return parseTranscript(data);
}

async function transcribeWithServer(audioBlob: Blob, mimeType: string): Promise<string> {
  const base64 = await blobToBase64(audioBlob);
  const { transcribeAudioServer } = await import("@/lib/deepgram-transcribe.server");
  const { transcript } = await transcribeAudioServer({
    data: { base64, mimeType: deepgramContentType(mimeType) },
  });
  return transcript;
}

export async function transcribeAudioBlob(audioBlob: Blob, mimeType: string): Promise<string> {
  if (audioBlob.size === 0) return "";

  const errors: string[] = [];

  // Server first — browser fetch to api.deepgram.com is often blocked by CORS.
  try {
    const transcript = await transcribeWithServer(audioBlob, mimeType);
    if (transcript) return transcript;
    errors.push("Server Deepgram returned empty transcript");
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Server Deepgram failed");
  }

  try {
    const transcript = await transcribeWithClient(audioBlob, mimeType);
    if (transcript) return transcript;
    errors.push("Client Deepgram returned empty transcript");
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Client Deepgram failed");
  }

  console.warn("Deepgram transcription failed:", errors.join("; "));
  throw new Error(
    "No speech detected in recording. Check your microphone input device in Mac System Settings → Sound → Input.",
  );
}
