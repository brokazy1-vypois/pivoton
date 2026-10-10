/** Keys used for Gemini across env files and ideation session storage. */
export const GEMINI_ENV_KEYS = ["GEMINI_API_KEY", "VITE_GEMINI_API_KEY"] as const;

export function readViteGeminiKey(): string {
  if (typeof import.meta === "undefined") return "";
  return (
    import.meta.env.VITE_GEMINI_API_KEY?.trim() ||
    import.meta.env.GEMINI_API_KEY?.trim() ||
    ""
  );
}

export function resolveGeminiKeyFromStorage(envVars: Record<string, string>): string {
  for (const key of GEMINI_ENV_KEYS) {
    const value = envVars[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Resolve Gemini key from session storage, then Vite-inlined client env. */
export function resolveClientGeminiKey(envVars: Record<string, string>): string {
  return resolveGeminiKeyFromStorage(envVars) || readViteGeminiKey();
}

export function hasGeminiKeyConfigured(envVars: Record<string, string>): boolean {
  return resolveClientGeminiKey(envVars).length > 0;
}

/** Remove Gemini secrets from env vars injected into prototype sandboxes. */
export function stripGeminiKeys(envVars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(envVars).filter(([key]) => !GEMINI_ENV_KEYS.includes(key as (typeof GEMINI_ENV_KEYS)[number])),
  );
}
