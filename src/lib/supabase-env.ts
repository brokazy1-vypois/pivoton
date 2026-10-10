/**
 * Supabase public credentials.
 * Prefer NEXT_PUBLIC_* (Vercel / Next-style) with VITE_* fallback for local dev.
 */
function readEnv(name: string, ...fallbackKeys: string[]): string {
  const keys = [name, ...fallbackKeys];
  const meta = import.meta.env as Record<string, string | undefined>;

  for (const key of keys) {
    const fromMeta = meta[key]?.trim();
    if (fromMeta) return fromMeta;
  }

  if (typeof process !== "undefined" && process.env) {
    for (const key of keys) {
      const fromProcess = process.env[key]?.trim();
      if (fromProcess) return fromProcess;
    }
  }

  return "";
}

export function getSupabaseUrl(): string {
  return readEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_URL",
  );
}

export function getSupabaseAnonKey(): string {
  return readEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
  );
}

export function isSupabaseEnvConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
