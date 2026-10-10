import type { AlpacaOAuthTokenRecord } from "@/types/trading-gateway";

const TOKEN_PREFIX = "pivoton-alpaca-oauth";

function storageKey(userId: string, gatewayId: string): string {
  return `${TOKEN_PREFIX}_${userId}_${gatewayId}`;
}

export function saveAlpacaOAuthToken(record: AlpacaOAuthTokenRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(record.userId, record.gatewayId), JSON.stringify(record));
}

export function getAlpacaOAuthToken(
  userId: string,
  gatewayId: string,
): AlpacaOAuthTokenRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId, gatewayId));
    return raw ? (JSON.parse(raw) as AlpacaOAuthTokenRecord) : null;
  } catch {
    return null;
  }
}

export function getPrimaryAlpacaOAuthToken(
  userId: string,
  gatewayIds: string[],
): AlpacaOAuthTokenRecord | null {
  for (const gatewayId of gatewayIds) {
    const token = getAlpacaOAuthToken(userId, gatewayId);
    if (token?.accessToken) return token;
  }
  return null;
}

export function removeAlpacaOAuthToken(userId: string, gatewayId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(userId, gatewayId));
}
