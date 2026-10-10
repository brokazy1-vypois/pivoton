import type { MarketplaceRumor } from "@/types/market-analysis";

export const MARKETPLACE_RUMORS: MarketplaceRumor[] = [
  {
    id: "RM-4471",
    sector: "Semiconductors",
    index: "NASDAQ-100",
    conviction: 86,
    firms: 4,
    cap: "$25,000",
    window: "Opens tomorrow 09:30 ET",
    trend: [22, 30, 27, 41, 38, 52, 61, 58, 74],
    assetLabel: "Industry-Leading Semiconductor Asset",
  },
  {
    id: "RM-4472",
    sector: "Clean Energy ETF",
    index: "S&P 500",
    conviction: 71,
    firms: 3,
    cap: "$40,000",
    window: "Opens tomorrow 09:30 ET",
    trend: [48, 44, 51, 47, 55, 53, 62, 66, 64],
    assetLabel: "Clean Energy ETF Allocation",
  },
  {
    id: "RM-4473",
    sector: "Regional Banking",
    index: "Russell 2000",
    conviction: 64,
    firms: 2,
    cap: "$12,000",
    window: "Opens tomorrow 09:30 ET",
    trend: [70, 62, 65, 58, 60, 54, 57, 49, 53],
    assetLabel: "Regional Banking Sector Asset",
  },
];

export function getMarketplaceRumor(refCode: string): MarketplaceRumor | undefined {
  return MARKETPLACE_RUMORS.find((r) => r.id === refCode);
}
