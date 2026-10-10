export type ExchangeVenueCategory = "us-primary" | "ats-regional" | "crypto-liquidity";

export interface AlpacaExchangeVenue {
  id: string;
  name: string;
  shortName: string;
  category: ExchangeVenueCategory;
  description: string;
}

/** Legal asset venues routable via Alpaca Broker API smart order routing. */
export const ALPACA_EXCHANGE_VENUES: AlpacaExchangeVenue[] = [
  {
    id: "nasdaq",
    name: "NASDAQ",
    shortName: "NASDAQ",
    category: "us-primary",
    description: "National Association of Securities Dealers Automated Quotations",
  },
  {
    id: "nyse",
    name: "NYSE",
    shortName: "NYSE",
    category: "us-primary",
    description: "New York Stock Exchange",
  },
  {
    id: "nyse-arca",
    name: "NYSE Arca",
    shortName: "Arca",
    category: "us-primary",
    description: "NYSE Arca electronic exchange",
  },
  {
    id: "nyse-american",
    name: "NYSE American",
    shortName: "NYSE American",
    category: "us-primary",
    description: "NYSE American (formerly AMEX)",
  },
  {
    id: "cboe-edga",
    name: "Cboe EDGA",
    shortName: "EDGA",
    category: "ats-regional",
    description: "Cboe Global Markets — EDGA",
  },
  {
    id: "cboe-edgx",
    name: "Cboe EDGX",
    shortName: "EDGX",
    category: "ats-regional",
    description: "Cboe Global Markets — EDGX",
  },
  {
    id: "cboe-bzx",
    name: "Cboe BZX",
    shortName: "BZX",
    category: "ats-regional",
    description: "Cboe Global Markets — BZX",
  },
  {
    id: "cboe-byx",
    name: "Cboe BYX",
    shortName: "BYX",
    category: "ats-regional",
    description: "Cboe Global Markets — BYX",
  },
  {
    id: "iex",
    name: "IEX",
    shortName: "IEX",
    category: "ats-regional",
    description: "Investors Exchange",
  },
  {
    id: "ltse",
    name: "LTSE",
    shortName: "LTSE",
    category: "ats-regional",
    description: "Long-Term Stock Exchange",
  },
  {
    id: "memx",
    name: "MEMX",
    shortName: "MEMX",
    category: "ats-regional",
    description: "Members Exchange",
  },
  {
    id: "miax-pearl",
    name: "MIAX PEARL",
    shortName: "MIAX PEARL",
    category: "ats-regional",
    description: "Miami International Securities Exchange PEARL",
  },
  {
    id: "alpaca-crypto-network",
    name: "Alpaca Crypto Liquidity Network",
    shortName: "Alpaca Crypto",
    category: "crypto-liquidity",
    description: "Aggregated crypto liquidity via Alpaca",
  },
  {
    id: "coinbase-route",
    name: "Coinbase Route",
    shortName: "Coinbase",
    category: "crypto-liquidity",
    description: "Coinbase liquidity route",
  },
  {
    id: "bitstamp-route",
    name: "Bitstamp Route",
    shortName: "Bitstamp",
    category: "crypto-liquidity",
    description: "Bitstamp liquidity route",
  },
  {
    id: "lmax-route",
    name: "LMAX Exchange Route",
    shortName: "LMAX",
    category: "crypto-liquidity",
    description: "LMAX Exchange liquidity route",
  },
];

export const ALPACA_EXCHANGE_VENUE_COUNT = ALPACA_EXCHANGE_VENUES.length;

export const DEFAULT_EQUITY_EXCHANGE_ROUTES = [
  "nasdaq",
  "nyse",
  "nyse-arca",
  "nyse-american",
  "cboe-edga",
  "cboe-edgx",
  "cboe-bzx",
  "cboe-byx",
  "iex",
  "ltse",
  "memx",
  "miax-pearl",
];

export const DEFAULT_CRYPTO_EXCHANGE_ROUTES = [
  "alpaca-crypto-network",
  "coinbase-route",
  "bitstamp-route",
  "lmax-route",
];

export function getExchangeVenue(id: string): AlpacaExchangeVenue | undefined {
  return ALPACA_EXCHANGE_VENUES.find((venue) => venue.id === id);
}

export function resolveExchangeRouteLabels(routeIds: string[]): string[] {
  return routeIds
    .map((id) => getExchangeVenue(id)?.shortName ?? id)
    .filter(Boolean);
}

export function exchangeRoutesForAssetClasses(assetClasses: string[]): string[] {
  const hasCrypto = assetClasses.some((asset) => asset.toLowerCase().includes("crypto"));
  return hasCrypto
    ? [...DEFAULT_EQUITY_EXCHANGE_ROUTES, ...DEFAULT_CRYPTO_EXCHANGE_ROUTES]
    : [...DEFAULT_EQUITY_EXCHANGE_ROUTES];
}
