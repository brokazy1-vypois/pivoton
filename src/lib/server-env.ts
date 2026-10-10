/**
 * Resolve server-side secrets from process env and Vite-inlined import.meta.env.
 * Vite only replaces *static* import.meta.env.KEY accesses — not dynamic meta[key].
 */
function fromProcess(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return process.env[name]?.trim() ?? "";
}

/** Static import.meta.env reads so Vite/Nitro can inline values from .env.local at build/dev time. */
function fromVite(name: string): string {
  switch (name) {
    case "VITE_TWELVE_DATA_API_KEY":
      return import.meta.env.VITE_TWELVE_DATA_API_KEY?.trim() ?? "";
    case "TWELVE_DATA_API_KEY":
      return import.meta.env.TWELVE_DATA_API_KEY?.trim() ?? "";
    case "VITE_GEMINI_API_KEY":
      return import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? "";
    case "GEMINI_API_KEY":
      return import.meta.env.GEMINI_API_KEY?.trim() ?? "";
    case "ALPACA_API_KEY_ID":
      return import.meta.env.ALPACA_API_KEY_ID?.trim() ?? "";
    case "ALPACA_API_SECRET_KEY":
      return import.meta.env.ALPACA_API_SECRET_KEY?.trim() ?? "";
    case "ALPACA_PAPER_BASE_URL":
      return import.meta.env.ALPACA_PAPER_BASE_URL?.trim() ?? "";
    case "ALPACA_BASE_URL":
      return import.meta.env.ALPACA_BASE_URL?.trim() ?? "";
    case "ALPACA_DATA_URL":
      return import.meta.env.ALPACA_DATA_URL?.trim() ?? "";
    case "NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID":
      return import.meta.env.NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID?.trim() ?? "";
    case "ALPACA_OAUTH_CLIENT_ID":
      return import.meta.env.ALPACA_OAUTH_CLIENT_ID?.trim() ?? "";
    case "ALPACA_OAUTH_CLIENT_SECRET":
      return import.meta.env.ALPACA_OAUTH_CLIENT_SECRET?.trim() ?? "";
    case "NEXT_PUBLIC_ALPACA_REDIRECT_URI":
      return import.meta.env.NEXT_PUBLIC_ALPACA_REDIRECT_URI?.trim() ?? "";
    case "ALPACA_REDIRECT_URI":
      return import.meta.env.ALPACA_REDIRECT_URI?.trim() ?? "";
    case "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID":
      return import.meta.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
    case "GOOGLE_OAUTH_CLIENT_ID":
      return import.meta.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
    case "GOOGLE_OAUTH_CLIENT_SECRET":
      return import.meta.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
    case "NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI":
      return import.meta.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";
    case "GOOGLE_OAUTH_REDIRECT_URI":
      return import.meta.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";
    default:
      return "";
  }
}

export function getServerEnv(key: string, ...fallbackKeys: string[]): string {
  for (const name of [key, ...fallbackKeys]) {
    const fromProc = fromProcess(name);
    if (fromProc) return fromProc;
  }

  for (const name of [key, ...fallbackKeys]) {
    const fromMeta = fromVite(name);
    if (fromMeta) return fromMeta;
  }

  return "";
}

export function getTwelveDataApiKey(): string {
  return getServerEnv("TWELVE_DATA_API_KEY", "VITE_TWELVE_DATA_API_KEY");
}

export function getGeminiApiKey(): string {
  return getServerEnv("GEMINI_API_KEY", "VITE_GEMINI_API_KEY");
}

export function getAlpacaApiKeyId(): string {
  return getServerEnv("ALPACA_API_KEY_ID");
}

export function getAlpacaApiSecretKey(): string {
  return getServerEnv("ALPACA_API_SECRET_KEY");
}

export function getAlpacaBaseUrl(): string {
  return (
    getServerEnv("ALPACA_PAPER_BASE_URL", "ALPACA_BASE_URL") ||
    "https://paper-api.alpaca.markets"
  );
}

export function getAlpacaDataUrl(): string {
  return getServerEnv("ALPACA_DATA_URL") || "https://data.alpaca.markets";
}

export function getAlpacaOAuthClientId(): string {
  return getServerEnv("NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID", "ALPACA_OAUTH_CLIENT_ID");
}

export function getAlpacaOAuthClientSecret(): string {
  return getServerEnv("ALPACA_OAUTH_CLIENT_SECRET");
}

export function getAlpacaOAuthRedirectUri(): string {
  return (
    getServerEnv("NEXT_PUBLIC_ALPACA_REDIRECT_URI", "ALPACA_REDIRECT_URI") ||
    "http://localhost:8080/api/auth/alpaca/callback"
  );
}

export function isAlpacaConfigured(): boolean {
  return Boolean(getAlpacaApiKeyId() && getAlpacaApiSecretKey());
}

export function isAlpacaOAuthConfigured(): boolean {
  return Boolean(getAlpacaOAuthClientId() && getAlpacaOAuthClientSecret());
}

export function getGoogleOAuthClientId(): string {
  return getServerEnv("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
}

export function getGoogleOAuthClientSecret(): string {
  return getServerEnv("GOOGLE_OAUTH_CLIENT_SECRET");
}

export function getGoogleOAuthRedirectUri(): string {
  return (
    getServerEnv("NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI") ||
    "http://localhost:8080/api/auth/google/callback"
  );
}

export function isGoogleCalendarOAuthConfigured(): boolean {
  return Boolean(getGoogleOAuthClientId() && getGoogleOAuthClientSecret());
}
