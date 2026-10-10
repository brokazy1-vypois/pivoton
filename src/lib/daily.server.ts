import { createServerFn } from "@tanstack/react-start";
import { getServerEnv } from "@/lib/server-env";

const DAILY_API_BASE = "https://api.daily.co/v1";

function extractPayload(ctx: unknown): { displayName: string; videoEnabled: boolean } {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") {
      const { displayName, videoEnabled } = data as {
        displayName?: string;
        videoEnabled?: boolean;
      };
      return {
        displayName: displayName?.trim() || "pivoton-peer-call",
        videoEnabled: Boolean(videoEnabled),
      };
    }
  }
  return { displayName: "pivoton-peer-call", videoEnabled: true };
}

function slugifyRoomName(name: string): string {
  return `pivoton-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)}-${Date.now().toString(36)}`;
}

function getDailyApiKey(): string {
  return getServerEnv("DAILY_API_KEY", "VITE_DAILY_API_KEY", "NEXT_PUBLIC_DAILY_API_KEY");
}

export const createPeerCallRoomServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ url: string }> => {
    const persistent = getServerEnv("VITE_DAILY_ROOM_URL", "NEXT_PUBLIC_DAILY_ROOM_URL");
    if (persistent) return { url: persistent };

    const apiKey = getDailyApiKey();
    if (!apiKey) {
      throw new Error("Daily.co API key is not configured on the server.");
    }

    const { displayName, videoEnabled } = extractPayload(ctx);
    const name = slugifyRoomName(displayName);

    const response = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 7200,
          enable_chat: false,
          enable_screenshare: videoEnabled,
          start_video_off: !videoEnabled,
          start_audio_off: false,
          max_participants: 2,
          enable_knocking: false,
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Daily room: ${error}`);
    }

    const data = (await response.json()) as { url: string };
    return { url: data.url };
  },
);
