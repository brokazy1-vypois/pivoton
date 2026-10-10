/** Mapbox public access token — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env.local */
function readEnv(name: string, viteName: string): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  const fromMeta = meta[name]?.trim() || meta[viteName]?.trim();
  if (fromMeta) return fromMeta;

  if (typeof process !== "undefined" && process.env) {
    return process.env[name]?.trim() || process.env[viteName]?.trim() || "";
  }

  return "";
}

export function getMapboxAccessToken(): string {
  return readEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "VITE_MAPBOX_ACCESS_TOKEN");
}

export function isMapboxConfigured(): boolean {
  return Boolean(getMapboxAccessToken());
}
