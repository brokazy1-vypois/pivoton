import { getMarketplaceRumor } from "@/data/marketplace-rumors";

/** Server-only — never import from client components. */
export interface SecretAssetMapping {
  ticker: string;
  name: string;
  sector: string;
}

export const ASSET_MAPPING: Record<string, SecretAssetMapping> = {
  "RM-4471": { ticker: "NVDA", name: "Semiconductors", sector: "NASDAQ-100" },
  "RM-4472": { ticker: "ICLN", name: "Clean Energy ETF", sector: "S&P 500" },
  "RM-4473": { ticker: "KRE", name: "Regional Banking", sector: "Russell 2000" },
  RM4471: { ticker: "NVDA", name: "Semiconductors", sector: "NASDAQ-100" },
  RM4472: { ticker: "ICLN", name: "Clean Energy ETF", sector: "S&P 500" },
  RM4473: { ticker: "KRE", name: "Regional Banking", sector: "Russell 2000" },
};

/** Normalize ref codes like RM4471 → RM-4471 */
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  const hyphenated = trimmed.replace(/^RM(\d{4})$/, "RM-$1");
  if (ASSET_MAPPING[hyphenated]) return hyphenated;
  if (ASSET_MAPPING[trimmed]) return trimmed;

  const digits = trimmed.match(/^RM-?(\d{4})$/);
  if (digits) return `RM-${digits[1]}`;

  return trimmed;
}

export function resolveAssetMapping(refCode: unknown): SecretAssetMapping | null {
  const normalized = normalizeRefCode(refCode);
  if (!normalized) return null;
  return ASSET_MAPPING[normalized] ?? null;
}

export function resolveMarketRumor(refCode: unknown) {
  const normalized = normalizeRefCode(refCode);
  if (!normalized) return undefined;
  return getMarketplaceRumor(normalized);
}

export function getBlockedIdentifiers(): string[] {
  const tickers = Object.values(ASSET_MAPPING).map((m) => m.ticker);
  return [
    ...new Set([
      ...tickers,
      "NVIDIA",
      "Nvidia",
      "nvidia",
      "iShares",
      "Global Clean Energy",
      "SPDR",
      "S&P Regional Banking",
      "Regional Banking ETF",
      "BlackRock",
      "State Street",
    ]),
  ];
}
