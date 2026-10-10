import { createServerFn } from "@tanstack/react-start";

interface RenderRequest {
  glbUrl: string;
  durationSec?: number;
  fps?: number;
  format?: "webm" | "gif";
  transparent?: boolean;
  framing?: "head" | "full";
}

interface RenderResponse {
  videoUrl: string;
  posterUrl: string;
}

function readServerRenderConfig(): { apiKey: string; apiUrl: string } {
  const apiKey =
    process.env.RENDER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_RENDER_API_KEY?.trim() ||
    process.env.VITE_RENDER_API_KEY?.trim() ||
    "";
  const apiUrl =
    process.env.RENDER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_RENDER_API_URL?.trim() ||
    process.env.VITE_RENDER_API_URL?.trim() ||
    "";
  return { apiKey, apiUrl };
}

/**
 * Server-side proxy for optional 3D→video render services (Shotstack, etc.).
 * Wire RENDER_API_KEY + RENDER_API_URL to your provider; returns null when unset.
 */
export const requestAvaturnRenderServer = createServerFn({ method: "POST" }).handler(
  async (ctx: unknown): Promise<RenderResponse | null> => {
    const payload =
      ctx && typeof ctx === "object" && "data" in ctx
        ? ((ctx as { data: unknown }).data as RenderRequest)
        : null;

    if (!payload?.glbUrl) return null;

    const { apiKey, apiUrl } = readServerRenderConfig();
    if (!apiKey || !apiUrl) return null;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        glbUrl: payload.glbUrl,
        durationSec: payload.durationSec ?? 2.5,
        fps: payload.fps ?? 24,
        format: payload.format ?? "webm",
        transparent: payload.transparent ?? true,
        framing: payload.framing ?? "head",
      }),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as Partial<RenderResponse>;
    if (!result.videoUrl || !result.posterUrl) return null;

    return { videoUrl: result.videoUrl, posterUrl: result.posterUrl };
  },
);
