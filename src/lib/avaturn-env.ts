/** Avaturn iframe host — set NEXT_PUBLIC_AVATURN_URL in .env.local */
function readEnv(name: string, viteName: string): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  const fromMeta = meta[name]?.trim() || meta[viteName]?.trim();
  if (fromMeta) return fromMeta;

  if (typeof process !== "undefined" && process.env) {
    return process.env[name]?.trim() || process.env[viteName]?.trim() || "";
  }

  return "";
}

const DEFAULT_AVATURN_URL = "https://pivoton.avaturn.dev";

export function getAvaturnUrl(): string {
  return readEnv("NEXT_PUBLIC_AVATURN_URL", "VITE_AVATURN_URL") || DEFAULT_AVATURN_URL;
}

export function isAvaturnConfigured(): boolean {
  return Boolean(getAvaturnUrl());
}

export interface AvaturnExportMessage {
  source?: string;
  action?: string;
  url?: string;
  model?: string;
}

export interface AvaturnExportResult {
  url: string;
  urlType: "dataURL" | "httpURL";
  avatarId?: string;
}

export function parseAvaturnExportUrl(data: unknown): string | null {
  const result = parseAvaturnExportResult(data);
  return result?.url ?? null;
}

/** Parse legacy postMessage payloads and SDK export objects. */
export function parseAvaturnExportResult(data: unknown): AvaturnExportResult | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;

  // Official SDK export callback payload
  if (typeof payload.url === "string" && payload.url.length > 0) {
    const urlType = payload.urlType === "dataURL" ? "dataURL" : "httpURL";
    return {
      url: payload.url,
      urlType,
      avatarId: typeof payload.avatarId === "string" ? payload.avatarId : undefined,
    };
  }

  // Legacy parent-page postMessage format from original spec
  const legacy = payload as AvaturnExportMessage;
  if (legacy.source === "avaturn" && legacy.action === "export") {
    const url = legacy.url ?? legacy.model;
    if (typeof url === "string" && url.length > 0) {
      return {
        url,
        urlType: url.startsWith("data:") ? "dataURL" : "httpURL",
      };
    }
  }

  return null;
}
