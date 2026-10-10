export type GatewayConnectionStatus = "not_connected" | "connecting" | "connected";

export type GatewayCategory =
  | "infrastructure"
  | "us-securities"
  | "global-brokerage"
  | "regulated-exchange";

export interface TradingGateway {
  id: string;
  name: string;
  category: GatewayCategory;
  assetClasses: string[];
  regions: string[];
  fee: string;
  viaAlpaca: boolean;
  /** Alpaca smart-routing venue ids embedded under this broker card. */
  exchangeRoutes: string[];
}

export interface GatewayAllocation {
  gatewayId: string;
  gatewayName: string;
  amount: number;
}

export interface InvestmentHolding {
  id: string;
  rumorId: string;
  rumorSector: string;
  totalAmount: number;
  allocations: GatewayAllocation[];
  status: "locked";
  createdAt: string;
  /** Server-side Alpaca order ids — no ticker exposure in UI. */
  alpacaOrderIds?: string[];
  routedVenues?: string[];
}

export interface AlpacaOAuthTokenRecord {
  accessToken: string;
  tokenType: string;
  gatewayId: string;
  userId: string;
  connectedAt: string;
}

export type AlpacaTimeInForce = "day" | "gtc";

export interface MarketplaceReserveExecutionInput {
  rumorId: string;
  allocations: GatewayAllocation[];
  timeInForce?: AlpacaTimeInForce;
  oauthAccessToken?: string;
}

export interface MarketplaceReserveExecutionResult {
  refCode: string;
  rumorSector: string;
  orderIds: string[];
  routedVenues: string[];
  totalNotional: number;
}
