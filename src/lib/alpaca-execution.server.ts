import { createServerFn } from "@tanstack/react-start";
import {
  DEFAULT_CRYPTO_EXCHANGE_ROUTES,
  DEFAULT_EQUITY_EXCHANGE_ROUTES,
  resolveExchangeRouteLabels,
} from "@/data/alpaca-exchanges";
import { getTradingGateway } from "@/data/trading-gateways";
import { alpacaApiRequest } from "@/lib/alpaca-client.server";
import { resolveAssetMapping, resolveMarketRumor } from "@/lib/market-asset-map.server";
import type {
  AlpacaTimeInForce,
  GatewayAllocation,
  MarketplaceReserveExecutionResult,
} from "@/types/trading-gateway";

interface AlpacaOrderResponse {
  id: string;
  status?: string;
  symbol?: string;
}

const SMART_ROUTING_VENUES = resolveExchangeRouteLabels([
  ...DEFAULT_EQUITY_EXCHANGE_ROUTES,
  ...DEFAULT_CRYPTO_EXCHANGE_ROUTES,
]);

function extractReservePayload(ctx: unknown): {
  rumorId: string;
  allocations: GatewayAllocation[];
  timeInForce: AlpacaTimeInForce;
  oauthAccessToken?: string;
} {
  const data =
    ctx && typeof ctx === "object" && "data" in ctx
      ? ((ctx as { data: unknown }).data as Record<string, unknown>)
      : {};

  const rumorId = String(data.rumorId ?? "").trim();
  const allocations = Array.isArray(data.allocations)
    ? (data.allocations as GatewayAllocation[])
    : [];
  const timeInForce = data.timeInForce === "gtc" ? "gtc" : "day";
  const oauthAccessToken =
    typeof data.oauthAccessToken === "string" && data.oauthAccessToken.trim()
      ? data.oauthAccessToken.trim()
      : undefined;

  if (!rumorId || allocations.length === 0) {
    throw new Error("Reserve execution requires a rumor id and gateway allocations.");
  }

  return { rumorId, allocations, timeInForce, oauthAccessToken };
}

async function submitNotionalOrder(input: {
  symbol: string;
  notional: number;
  timeInForce: AlpacaTimeInForce;
  oauthAccessToken?: string;
}): Promise<string> {
  const order = await alpacaApiRequest<AlpacaOrderResponse>({
    method: "POST",
    path: "/v2/orders",
    oauthAccessToken: input.oauthAccessToken,
    body: {
      symbol: input.symbol,
      notional: input.notional.toFixed(2),
      side: "buy",
      type: "market",
      time_in_force: input.timeInForce,
    },
  });

  if (!order.id) {
    throw new Error("Alpaca did not return an order id.");
  }

  return order.id;
}

/**
 * Route marketplace reserve through Alpaca POST /v2/orders.
 * Ticker resolution stays server-side — response is anonymized.
 */
export const executeMarketplaceReserveServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<MarketplaceReserveExecutionResult> => {
    const { rumorId, allocations, timeInForce, oauthAccessToken } =
      extractReservePayload(ctx);

    const mapping = resolveAssetMapping(rumorId);
    const rumor = resolveMarketRumor(rumorId);
    if (!mapping || !rumor) {
      throw new Error("Unknown opportunity reference code.");
    }

    const orderIds: string[] = [];
    const routedVenues = new Set<string>(SMART_ROUTING_VENUES);

    for (const allocation of allocations) {
      const gateway = getTradingGateway(allocation.gatewayId);
      if (!gateway) {
        throw new Error(`Unknown gateway: ${allocation.gatewayId}`);
      }

      resolveExchangeRouteLabels(gateway.exchangeRoutes).forEach((venue) =>
        routedVenues.add(venue),
      );

      const orderId = await submitNotionalOrder({
        symbol: mapping.ticker,
        notional: allocation.amount,
        timeInForce,
        oauthAccessToken,
      });
      orderIds.push(orderId);
    }

    return {
      refCode: rumor.id,
      rumorSector: rumor.sector,
      orderIds,
      routedVenues: [...routedVenues],
      totalNotional: allocations.reduce((sum, item) => sum + item.amount, 0),
    };
  },
);
