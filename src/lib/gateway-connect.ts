import type { AlpacaVerificationResult } from "@/lib/alpaca-gateway.server";

const DEV_VERIFY_DELAY_MS = 1000;

/** User-facing message — never surface raw "fetch failed" from undici/fetch. */
export function formatGatewayConnectError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Connection failed. Please check your network or API keys.";
  }

  const message = error.message.trim();
  const lower = message.toLowerCase();

  if (
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("failed to fetch") ||
    lower.includes("network request failed")
  ) {
    return "Could not reach the Alpaca verification service. Check your network or use Development Mode.";
  }

  if (lower.includes("not configured") || lower.includes("credentials")) {
    return "Alpaca credentials are not configured on the server.";
  }

  return message || "Connection failed. Please check your network or API keys.";
}

export function isGatewayNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("failed to fetch") ||
    lower.includes("network request failed")
  );
}

export function isDevModeVerification(result: AlpacaVerificationResult): boolean {
  return result.accountStatus === "DEV_MODE" || result.accountId === "dev-mode";
}

export async function simulateDevGatewayVerification(
  gatewayId: string,
): Promise<AlpacaVerificationResult> {
  await new Promise((resolve) => setTimeout(resolve, DEV_VERIFY_DELAY_MS));
  return {
    verified: true,
    gatewayId,
    accountId: "dev-mode",
    accountStatus: "DEV_MODE",
    buyingPower: "100000",
    currency: "USD",
  };
}

export function shouldAttemptDevGatewayFallback(error: unknown): boolean {
  if (import.meta.env.DEV) return true;
  if (!(error instanceof Error)) return false;

  const lower = error.message.toLowerCase();
  return (
    isGatewayNetworkError(error) ||
    lower.includes("not configured") ||
    lower.includes("oauth is not configured")
  );
}
