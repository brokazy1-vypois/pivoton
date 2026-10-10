import { createServerFn } from "@tanstack/react-start";
import {
  getAlpacaOAuthClientId,
  getAlpacaOAuthClientSecret,
  getAlpacaOAuthRedirectUri,
  isAlpacaOAuthConfigured,
} from "@/lib/server-env";

const ALPACA_AUTHORIZE_URL = "https://app.alpaca.markets/oauth/authorize";
const ALPACA_TOKEN_URL = "https://api.alpaca.markets/oauth/token";
const ALPACA_REVOKE_URL = "https://api.alpaca.markets/oauth/revoke";

export interface AlpacaOAuthStatePayload {
  gatewayId: string;
  userId: string;
  nonce: string;
}

export interface AlpacaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

export function encodeOAuthState(payload: AlpacaOAuthStatePayload): string {
  return btoa(JSON.stringify(payload));
}

export function decodeOAuthState(raw: string): AlpacaOAuthStatePayload | null {
  try {
    const parsed = JSON.parse(atob(raw)) as AlpacaOAuthStatePayload;
    if (!parsed.gatewayId || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireOAuthConfig() {
  if (!isAlpacaOAuthConfigured()) {
    throw new Error(
      "Alpaca OAuth is not configured. Set NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID and ALPACA_OAUTH_CLIENT_SECRET.",
    );
  }
}

/** Build Alpaca Connect authorization URL (OAuth 2.0). */
export const getAlpacaOAuthAuthorizeUrlServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ url: string; state: string }> => {
    requireOAuthConfig();

    const data = extractData(ctx);
    const gatewayId = String(data.gatewayId ?? "").trim();
    const userId = String(data.userId ?? "").trim();
    if (!gatewayId || !userId) {
      throw new Error("Gateway id and user id are required for OAuth.");
    }

    const state = encodeOAuthState({
      gatewayId,
      userId,
      nonce: crypto.randomUUID(),
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: getAlpacaOAuthClientId(),
      redirect_uri: getAlpacaOAuthRedirectUri(),
      state,
      scope: "account:write trading",
      env: "paper",
    });

    return {
      url: `${ALPACA_AUTHORIZE_URL}?${params.toString()}`,
      state,
    };
  },
);

/** Exchange authorization code for access token (server-only). */
export const exchangeAlpacaOAuthCodeServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{
    accessToken: string;
    tokenType: string;
    gatewayId: string;
    userId: string;
  }> => {
    requireOAuthConfig();

    const data = extractData(ctx);
    const code = String(data.code ?? "").trim();
    const stateRaw = String(data.state ?? "").trim();
    if (!code || !stateRaw) {
      throw new Error("OAuth code and state are required.");
    }

    const state = decodeOAuthState(stateRaw);
    if (!state) {
      throw new Error("Invalid OAuth state payload.");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getAlpacaOAuthClientId(),
      client_secret: getAlpacaOAuthClientSecret(),
      redirect_uri: getAlpacaOAuthRedirectUri(),
    });

    const response = await fetch(ALPACA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(12_000),
    });

    const payload = (await response.json().catch(() => ({}))) as AlpacaOAuthTokenResponse & {
      message?: string;
    };

    if (!response.ok || !payload.access_token) {
      throw new Error(payload.message ?? "Alpaca OAuth token exchange failed.");
    }

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type ?? "Bearer",
      gatewayId: state.gatewayId,
      userId: state.userId,
    };
  },
);

/** Revoke Alpaca OAuth access when disconnecting a trading gateway. */
export const disconnectAlpacaGatewayServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ disconnected: boolean }> => {
    const data = extractData(ctx);
    const gatewayId = String(data.gatewayId ?? "").trim();
    const userId = String(data.userId ?? "").trim();
    const oauthAccessToken =
      typeof data.oauthAccessToken === "string" ? data.oauthAccessToken : undefined;

    if (!gatewayId || !userId) {
      throw new Error("Gateway id and user id are required to disconnect.");
    }

    if (oauthAccessToken && isAlpacaOAuthConfigured()) {
      try {
        const body = new URLSearchParams({
          client_id: getAlpacaOAuthClientId(),
          client_secret: getAlpacaOAuthClientSecret(),
          token: oauthAccessToken,
        });

        await fetch(ALPACA_REVOKE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: AbortSignal.timeout(12_000),
        });
      } catch (error) {
        console.warn("[Alpaca] OAuth revoke request failed:", error);
      }
    }

    return { disconnected: true };
  },
);

export function isAlpacaOAuthEnabledServer(): boolean {
  return isAlpacaOAuthConfigured();
}
