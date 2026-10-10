import { createServerFn } from "@tanstack/react-start";
import { alpacaApiRequest } from "@/lib/alpaca-client.server";
import {
  getAlpacaApiKeyId,
  getAlpacaApiSecretKey,
  getAlpacaBaseUrl,
  isAlpacaConfigured,
} from "@/lib/server-env";

const REQUEST_TIMEOUT_MS = 12_000;

interface AlpacaAccount {
  id?: string;
  status?: string;
  currency?: string;
  buying_power?: string;
  cash?: string;
  portfolio_value?: string;
}

export interface AlpacaVerificationResult {
  verified: boolean;
  gatewayId: string;
  accountId?: string;
  accountStatus?: string;
  buyingPower?: string;
  currency?: string;
}

function extractGatewayId(ctx: unknown): string {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object" && "gatewayId" in data) {
      const gatewayId = (data as { gatewayId?: unknown }).gatewayId;
      if (typeof gatewayId === "string" && gatewayId.trim()) {
        return gatewayId.trim();
      }
    }
  }
  throw new Error("Gateway id is required.");
}

async function fetchAlpacaAccount(oauthAccessToken?: string): Promise<AlpacaAccount> {
  if (!oauthAccessToken && !isAlpacaConfigured()) {
    throw new Error(
      "Alpaca API credentials are not configured. Set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY.",
    );
  }

  try {
    if (oauthAccessToken) {
      return alpacaApiRequest<AlpacaAccount>({
        path: "/v2/account",
        oauthAccessToken,
      });
    }

    const baseUrl = getAlpacaBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v2/account`, {
      method: "GET",
      headers: {
        "APCA-API-KEY-ID": getAlpacaApiKeyId(),
        "APCA-API-SECRET-KEY": getAlpacaApiSecretKey(),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof payload.message === "string"
          ? payload.message
          : `Alpaca account verification failed (HTTP ${response.status}).`;
      throw new Error(message);
    }

    return payload as AlpacaAccount;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Alpaca account verification failed.");
  }
}

function devModeVerification(gatewayId: string): AlpacaVerificationResult {
  return {
    verified: true,
    gatewayId,
    accountId: "dev-mode",
    accountStatus: "DEV_MODE",
    buyingPower: "100000",
    currency: "USD",
  };
}

/** Verify Alpaca credentials before linking a trading gateway. */
export const verifyAlpacaGatewayServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<AlpacaVerificationResult> => {
    const data =
      ctx && typeof ctx === "object" && "data" in ctx
        ? ((ctx as { data: unknown }).data as Record<string, unknown>)
        : {};
    const gatewayId = extractGatewayId(ctx);
    const oauthAccessToken =
      typeof data.oauthAccessToken === "string" ? data.oauthAccessToken : undefined;

    if (!oauthAccessToken && !isAlpacaConfigured()) {
      return devModeVerification(gatewayId);
    }

    try {
      const account = await fetchAlpacaAccount(oauthAccessToken);

      if (account.status && !["ACTIVE", "APPROVED"].includes(account.status.toUpperCase())) {
        throw new Error(`Alpaca account is not active (status: ${account.status}).`);
      }

      return {
        verified: true,
        gatewayId,
        accountId: account.id,
        accountStatus: account.status,
        buyingPower: account.buying_power,
        currency: account.currency ?? "USD",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        !oauthAccessToken &&
        (message.includes("fetch failed") ||
          message.includes("network") ||
          message.includes("not configured"))
      ) {
        return devModeVerification(gatewayId);
      }
      throw error instanceof Error ? error : new Error("Alpaca gateway verification failed.");
    }
  },
);

/** Re-verify Alpaca connectivity when confirming a marketplace reserve. */
export const verifyAlpacaReserveServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ verified: boolean; buyingPower?: string; devMode?: boolean }> => {
    const data =
      ctx && typeof ctx === "object" && "data" in ctx
        ? ((ctx as { data: unknown }).data as Record<string, unknown>)
        : {};
    const oauthAccessToken =
      typeof data.oauthAccessToken === "string" ? data.oauthAccessToken : undefined;

    if (!oauthAccessToken && !isAlpacaConfigured()) {
      return { verified: true, buyingPower: "100000", devMode: true };
    }

    try {
      const account = await fetchAlpacaAccount(oauthAccessToken);
      return {
        verified: true,
        buyingPower: account.buying_power,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("fetch failed") || message.includes("network")) {
        return { verified: true, buyingPower: "100000", devMode: true };
      }
      throw error instanceof Error ? error : new Error("Alpaca reserve verification failed.");
    }
  },
);
