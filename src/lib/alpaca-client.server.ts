import {
  getAlpacaApiKeyId,
  getAlpacaApiSecretKey,
  getAlpacaBaseUrl,
  isAlpacaConfigured,
} from "@/lib/server-env";

const REQUEST_TIMEOUT_MS = 12_000;

export interface AlpacaRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  oauthAccessToken?: string;
}

export async function alpacaApiRequest<T>(options: AlpacaRequestOptions): Promise<T> {
  const baseUrl = getAlpacaBaseUrl().replace(/\/$/, "");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.oauthAccessToken) {
    headers.Authorization = `Bearer ${options.oauthAccessToken}`;
  } else if (isAlpacaConfigured()) {
    headers["APCA-API-KEY-ID"] = getAlpacaApiKeyId();
    headers["APCA-API-SECRET-KEY"] = getAlpacaApiSecretKey();
  } else {
    throw new Error("Alpaca credentials are not configured.");
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `Alpaca API request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}
