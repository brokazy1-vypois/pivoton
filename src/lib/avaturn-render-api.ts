import type { AnimatedAvatarResult } from "@/lib/avaturn-animated-avatar";

function readRenderApiKey(): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  return (
    meta.NEXT_PUBLIC_RENDER_API_KEY?.trim() ||
    meta.VITE_RENDER_API_KEY?.trim() ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_RENDER_API_KEY?.trim() ||
        process.env.VITE_RENDER_API_KEY?.trim() ||
        ""
      : "")
  );
}

function readRenderApiUrl(): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  return (
    meta.NEXT_PUBLIC_RENDER_API_URL?.trim() ||
    meta.VITE_RENDER_API_URL?.trim() ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_RENDER_API_URL?.trim() ||
        process.env.VITE_RENDER_API_URL?.trim() ||
        ""
      : "")
  );
}

/**
 * Optional serverless 3D→video render (Shotstack / custom render farm).
 * Set NEXT_PUBLIC_RENDER_API_KEY + NEXT_PUBLIC_RENDER_API_URL to enable.
 */
export async function requestServerAvatarRender(
  glbUrl: string,
): Promise<AnimatedAvatarResult | null> {
  const apiKey = readRenderApiKey();
  const apiUrl = readRenderApiUrl();

  if (!apiKey || !apiUrl) return null;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        glbUrl,
        durationSec: 2.5,
        fps: 24,
        format: "webm",
        transparent: true,
        framing: "head",
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      videoUrl?: string;
      posterUrl?: string;
    };

    if (!payload.videoUrl || !payload.posterUrl) return null;

    const [videoRes, posterRes] = await Promise.all([
      fetch(payload.videoUrl),
      fetch(payload.posterUrl),
    ]);

    if (!videoRes.ok || !posterRes.ok) return null;

    const [video, poster] = await Promise.all([videoRes.blob(), posterRes.blob()]);

    return {
      video,
      poster,
      mediaType: "video",
      mimeType: video.type || "video/webm",
    };
  } catch (error) {
    console.warn("[Avaturn] Server render API unavailable, using client pipeline.", error);
    return null;
  }
}

export function isServerAvatarRenderConfigured(): boolean {
  return Boolean(readRenderApiKey() && readRenderApiUrl());
}
