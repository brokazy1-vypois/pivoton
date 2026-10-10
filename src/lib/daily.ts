import { createPeerCallRoomServer } from "@/lib/daily.server";

const DAILY_API_BASE = "https://api.daily.co/v1";

function readDailyApiKey(): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  return (
    meta.VITE_DAILY_API_KEY?.trim() ||
    meta.DAILY_API_KEY?.trim() ||
    meta.NEXT_PUBLIC_DAILY_API_KEY?.trim() ||
    ""
  );
}

function slugifyRoomName(name: string): string {
  return `pivoton-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)}-${Date.now().toString(36)}`;
}

/** Optional persistent demo room — set VITE_DAILY_ROOM_URL in .env.local to skip API creation */
export function getPersistentRoomUrl(): string | null {
  const meta = import.meta.env as Record<string, string | undefined>;
  const url = meta.VITE_DAILY_ROOM_URL?.trim() || meta.NEXT_PUBLIC_DAILY_ROOM_URL?.trim();
  return url || null;
}

async function createDailyRoomClient(displayName: string, videoEnabled = true): Promise<string> {
  const persistent = getPersistentRoomUrl();
  if (persistent) return persistent;

  const apiKey = readDailyApiKey();
  if (!apiKey) {
    throw new Error(
      "Daily.co API key is not configured. Set VITE_DAILY_API_KEY or DAILY_API_KEY in .env.local",
    );
  }

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
  return data.url;
}

export async function createDailyRoom(displayName: string): Promise<string> {
  return createPeerCallRoom({ displayName, videoEnabled: true });
}

export async function createPeerCallRoom(input: {
  displayName: string;
  videoEnabled: boolean;
}): Promise<string> {
  const persistent = getPersistentRoomUrl();
  if (persistent) return persistent;

  try {
    const result = await createPeerCallRoomServer({
      data: {
        displayName: input.displayName,
        videoEnabled: input.videoEnabled,
      },
    });
    if (result?.url) return result.url;
  } catch {
    // Fall back to direct client-side room creation below.
  }

  return createDailyRoomClient(input.displayName, input.videoEnabled);
}
