import type { GatewayCategory, TradingGateway } from "@/types/trading-gateway";
import { exchangeRoutesForAssetClasses } from "@/data/alpaca-exchanges";

export const UNIFIED_GATEWAY_HEADLINE = "30+ Gateways & Exchanges";

export const GATEWAY_CATEGORY_LABELS: Record<GatewayCategory, string> = {
  infrastructure: "Infrastructure Gateways",
  "us-securities": "US Major Securities Firms",
  "global-brokerage": "Global Financial Venues & International Brokerages",
  "regulated-exchange": "Regulated Exchanges Routing",
};

const BASE_GATEWAYS: Omit<TradingGateway, "exchangeRoutes">[] = [
  // Infrastructure Gateways
  {
    id: "alpaca-securities",
    name: "Alpaca Securities LLC",
    category: "infrastructure",
    assetClasses: ["US Equities", "ETFs", "Options", "Crypto"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "interactive-brokers",
    name: "Interactive Brokers via Alpaca Connect",
    category: "infrastructure",
    assetClasses: ["US Equities", "ETFs", "Options"],
    regions: ["US", "EU", "APAC"],
    fee: "0.05% / order",
    viaAlpaca: true,
  },
  {
    id: "plaid-brokerage",
    name: "Plaid Brokerage Sync Gateway",
    category: "infrastructure",
    assetClasses: ["US Equities", "ETFs"],
    regions: ["US", "CA"],
    fee: "Multi-broker OAuth",
    viaAlpaca: true,
  },
  {
    id: "snaptrade",
    name: "SnapTrade Unified API Gateway",
    category: "infrastructure",
    assetClasses: ["US Equities", "Options", "Crypto"],
    regions: ["US", "Global"],
    fee: "Aggregated API",
    viaAlpaca: true,
  },
  {
    id: "drivewealth",
    name: "DriveWealth Direct Gateway",
    category: "infrastructure",
    assetClasses: ["US Fractional Equities", "ETFs"],
    regions: ["US", "Global"],
    fee: "API Clearing",
    viaAlpaca: true,
  },
  {
    id: "apex-clearing",
    name: "Apex Clearing Execution Gateway",
    category: "infrastructure",
    assetClasses: ["Equities", "Options", "Fixed Income"],
    regions: ["US"],
    fee: "Institutional Tier",
    viaAlpaca: true,
  },

  // US Major Securities Firms
  {
    id: "charles-schwab",
    name: "Charles Schwab & Co.",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options", "Bonds"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "fidelity",
    name: "Fidelity Investments",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options", "Mutual Funds"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "etrade",
    name: "E*TRADE (Morgan Stanley)",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "robinhood",
    name: "Robinhood Securities LLC",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options", "Crypto"],
    regions: ["US"],
    fee: "Zero-commission",
    viaAlpaca: true,
  },
  {
    id: "webull",
    name: "Webull Financial LLC",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["US", "APAC"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "vanguard",
    name: "Vanguard Brokerage Services",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Mutual Funds"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "merrill-edge",
    name: "Merrill Edge (BofA)",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["US"],
    fee: "Commission-free",
    viaAlpaca: true,
  },
  {
    id: "jp-morgan",
    name: "J.P. Morgan Self-Directed",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["US"],
    fee: "Zero commission",
    viaAlpaca: true,
  },
  {
    id: "tradestation",
    name: "TradeStation",
    category: "us-securities",
    assetClasses: ["Equities", "ETFs", "Futures", "Options"],
    regions: ["US"],
    fee: "$0 per trade",
    viaAlpaca: true,
  },

  // Global Financial Venues & International Brokerages
  {
    id: "tradingview",
    name: "TradingView Connect",
    category: "global-brokerage",
    assetClasses: ["US Equities", "ETFs", "Crypto"],
    regions: ["Global"],
    fee: "Spread + fee",
    viaAlpaca: true,
  },
  {
    id: "etoro",
    name: "eToro Gateway",
    category: "global-brokerage",
    assetClasses: ["Equities", "ETFs", "Crypto"],
    regions: ["US", "EU"],
    fee: "0.10% / order",
    viaAlpaca: true,
  },
  {
    id: "capital-com",
    name: "Capital.com",
    category: "global-brokerage",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["US", "EU"],
    fee: "Spread only",
    viaAlpaca: true,
  },
  {
    id: "sarwa",
    name: "Sarwa (APAC/MENA Gateway)",
    category: "global-brokerage",
    assetClasses: ["Equities", "ETFs"],
    regions: ["US", "APAC"],
    fee: "$0.99 flat",
    viaAlpaca: true,
  },
  {
    id: "saxo-bank",
    name: "Saxo Bank Gateway",
    category: "global-brokerage",
    assetClasses: ["Global Equities", "ETFs", "Futures"],
    regions: ["EU", "APAC"],
    fee: "Tiered Pricing",
    viaAlpaca: true,
  },
  {
    id: "ig-group",
    name: "IG Group Gateway",
    category: "global-brokerage",
    assetClasses: ["Equities", "ETFs", "Options"],
    regions: ["UK", "Global"],
    fee: "Spread / Commission",
    viaAlpaca: true,
  },

  // Regulated Exchanges Routing
  {
    id: "nasdaq-exchange",
    name: "NASDAQ Stock Market",
    category: "regulated-exchange",
    assetClasses: ["Primary Tech Equities", "ETFs"],
    regions: ["US"],
    fee: "Direct Market Access",
    viaAlpaca: true,
  },
  {
    id: "nyse-exchange",
    name: "NYSE (New York Stock Exchange)",
    category: "regulated-exchange",
    assetClasses: ["Primary Equities", "ETFs"],
    regions: ["US"],
    fee: "Direct Market Access",
    viaAlpaca: true,
  },
  {
    id: "cboe-exchange",
    name: "Cboe Global Markets",
    category: "regulated-exchange",
    assetClasses: ["Options", "Equities", "ETFs"],
    regions: ["US"],
    fee: "Direct Routing",
    viaAlpaca: true,
  },
  {
    id: "iex-exchange",
    name: "IEX (Investors Exchange)",
    category: "regulated-exchange",
    assetClasses: ["Equities", "Transparent Routing"],
    regions: ["US"],
    fee: "Direct Access",
    viaAlpaca: true,
  },
];

function routesForGateway(gateway: Omit<TradingGateway, "exchangeRoutes">): string[] {
  if (gateway.category === "regulated-exchange") {
    if (gateway.id === "nasdaq-exchange") return ["nasdaq"];
    if (gateway.id === "nyse-exchange") return ["nyse", "nyse-arca", "nyse-american"];
    if (gateway.id === "cboe-exchange") return ["cboe-edga", "cboe-edgx", "cboe-bzx", "cboe-byx"];
    if (gateway.id === "iex-exchange") return ["iex"];
  }
  return exchangeRoutesForAssetClasses(gateway.assetClasses);
}

/** Primary gateway catalog — category order preserved for default dashboard display. */
export const TRADING_GATEWAYS: TradingGateway[] = BASE_GATEWAYS.map((gateway) => ({
  ...gateway,
  exchangeRoutes: routesForGateway(gateway),
}));

export const TRADING_GATEWAY_COUNT = TRADING_GATEWAYS.length;

export const GATEWAY_CATEGORY_ORDER: GatewayCategory[] = [
  "infrastructure",
  "us-securities",
  "global-brokerage",
  "regulated-exchange",
];

export function getTradingGateway(id: string): TradingGateway | undefined {
  return TRADING_GATEWAYS.find((gateway) => gateway.id === id);
}

export function groupGatewaysByCategory(
  gateways: TradingGateway[],
): Record<GatewayCategory, TradingGateway[]> {
  return GATEWAY_CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = gateways.filter((gateway) => gateway.category === category);
      return acc;
    },
    {} as Record<GatewayCategory, TradingGateway[]>,
  );
}
