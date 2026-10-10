import {
  verifyAlpacaGatewayServer,
  verifyAlpacaReserveServer,
  type AlpacaVerificationResult,
} from "@/lib/alpaca-gateway.server";
import {
  exchangeAlpacaOAuthCodeServer,
  getAlpacaOAuthAuthorizeUrlServer,
  disconnectAlpacaGatewayServer,
} from "@/lib/alpaca-oauth.server";
import { executeMarketplaceReserveServer } from "@/lib/alpaca-execution.server";
import {
  formatGatewayConnectError,
  isDevModeVerification,
  shouldAttemptDevGatewayFallback,
  simulateDevGatewayVerification,
} from "@/lib/gateway-connect";
import type {
  GatewayAllocation,
  MarketplaceReserveExecutionResult,
} from "@/types/trading-gateway";
import { removeAlpacaOAuthToken } from "@/services/alpaca-oauth-tokens";

export async function verifyAlpacaGateway(
  gatewayId: string,
  oauthAccessToken?: string,
): Promise<AlpacaVerificationResult> {
  try {
    const result = await verifyAlpacaGatewayServer({ data: { gatewayId, oauthAccessToken } });
    if (isDevModeVerification(result)) {
      return simulateDevGatewayVerification(gatewayId);
    }
    return result;
  } catch (error) {
    if (shouldAttemptDevGatewayFallback(error)) {
      console.warn("[Alpaca] Live verification unavailable — using development fallback.", error);
      return simulateDevGatewayVerification(gatewayId);
    }
    throw new Error(formatGatewayConnectError(error));
  }
}

export async function verifyAlpacaForReserve(oauthAccessToken?: string): Promise<{
  verified: boolean;
  buyingPower?: string;
  devMode?: boolean;
}> {
  try {
    return await verifyAlpacaReserveServer({ data: { oauthAccessToken } });
  } catch (error) {
    if (shouldAttemptDevGatewayFallback(error)) {
      console.warn("[Alpaca] Reserve pre-check unavailable — continuing in development mode.", error);
      return { verified: true, buyingPower: "100000", devMode: true };
    }
    throw new Error(formatGatewayConnectError(error));
  }
}

export async function getAlpacaOAuthAuthorizeUrl(
  gatewayId: string,
  userId: string,
): Promise<{ url: string; state: string }> {
  try {
    return await getAlpacaOAuthAuthorizeUrlServer({ data: { gatewayId, userId } });
  } catch (error) {
    throw new Error(formatGatewayConnectError(error));
  }
}

export async function exchangeAlpacaOAuthCode(code: string, state: string) {
  try {
    return await exchangeAlpacaOAuthCodeServer({ data: { code, state } });
  } catch (error) {
    throw new Error(formatGatewayConnectError(error));
  }
}

export async function disconnectAlpacaGateway(input: {
  userId: string;
  gatewayId: string;
  oauthAccessToken?: string;
}): Promise<{ disconnected: boolean }> {
  try {
    const result = await disconnectAlpacaGatewayServer({
      data: {
        gatewayId: input.gatewayId,
        userId: input.userId,
        oauthAccessToken: input.oauthAccessToken,
      },
    });
    removeAlpacaOAuthToken(input.userId, input.gatewayId);
    return result;
  } catch (error) {
    console.warn("[Alpaca] Remote token revoke unavailable — clearing local gateway link.", error);
    removeAlpacaOAuthToken(input.userId, input.gatewayId);
    return { disconnected: true };
  }
}

export async function executeMarketplaceReserve(input: {
  rumorId: string;
  allocations: GatewayAllocation[];
  timeInForce?: "day" | "gtc";
  oauthAccessToken?: string;
}): Promise<MarketplaceReserveExecutionResult> {
  try {
    return await executeMarketplaceReserveServer({ data: input });
  } catch (error) {
    if (shouldAttemptDevGatewayFallback(error)) {
      console.warn("[Alpaca] Order routing unavailable — simulating reserve in development mode.", error);
      const totalNotional = input.allocations.reduce((sum, row) => sum + row.amount, 0);
      return {
        refCode: input.rumorId,
        rumorSector: "Reserved opportunity",
        orderIds: input.allocations.map((_, index) => `dev-order-${index + 1}`),
        routedVenues: ["NASDAQ", "NYSE", "Cboe", "IEX"],
        totalNotional,
      };
    }
    throw new Error(formatGatewayConnectError(error));
  }
}

export function isAlpacaOAuthClientConfigured(): boolean {
  const clientId = import.meta.env.NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID?.trim();
  return Boolean(clientId);
}

export function getGatewayConnectSuccessMessage(
  gatewayName: string,
  result: AlpacaVerificationResult,
): { title: string; description?: string } {
  if (isDevModeVerification(result)) {
    return {
      title: "Gateway connected successfully (Development Mode)",
      description: `${gatewayName} linked via simulated Alpaca Paper API verification.`,
    };
  }

  return {
    title: `${gatewayName} connected`,
    description: result.accountStatus
      ? `Alpaca account verified (${result.accountStatus}).`
      : "Alpaca API verification completed.",
  };
}

export {
  isDevModeVerification,
  formatGatewayConnectError,
  simulateDevGatewayVerification,
  shouldAttemptDevGatewayFallback,
};
