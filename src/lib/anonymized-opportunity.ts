import type { MarketplaceRumor } from "@/types/market-analysis";

/** Public-facing opportunity labels — never expose underlying tickers in reserve flows. */
export interface AnonymizedOpportunityView {
  refCode: string;
  sector: string;
  index: string;
}

export function toAnonymizedOpportunity(rumor: MarketplaceRumor): AnonymizedOpportunityView {
  return {
    refCode: rumor.id,
    sector: rumor.sector,
    index: rumor.index,
  };
}

export function formatAnonymizedReserveLabel(rumor: MarketplaceRumor): string {
  const { refCode, sector } = toAnonymizedOpportunity(rumor);
  return `${refCode} · ${sector}`;
}
