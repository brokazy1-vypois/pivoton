import { getConfiguredErpApiKey, resolveErpApiKey } from "@/lib/erp-env";
import {
  fetchErpOrderHistoryServer,
  fetchErpOrderTrackingServer,
  placeErpOrderServer,
  simulateFallbackStatus,
} from "@/lib/erp-orders.server";
import type {
  ErpInventoryItem,
  ErpInventoryResult,
  OrderTrackingUpdate,
  PlaceOrderInput,
  PlaceOrderResponse,
  ShopOrder,
} from "@/types/erp";
import { fetchErpInventoryServer } from "@/lib/erp-inventory.server";

export class ErpApiError extends Error {
  constructor(
    message: string,
    public readonly code: "AUTH" | "NETWORK" | "TIMEOUT" | "SERVER" | "PARSE" = "SERVER",
  ) {
    super(message);
    this.name = "ErpApiError";
  }
}

export function getErpApiKey(): string {
  return resolveErpApiKey();
}

export function isErpApiKeyConfigured(): boolean {
  return Boolean(getConfiguredErpApiKey());
}

export async function fetchErpInventory(): Promise<ErpInventoryResult> {
  return fetchErpInventoryServer();
}

export async function placeErpOrder(input: PlaceOrderInput): Promise<PlaceOrderResponse> {
  return placeErpOrderServer({ data: input });
}

export async function fetchErpOrderTracking(
  orderId: string,
  createdAt?: string,
): Promise<OrderTrackingUpdate | null> {
  const remote = await fetchErpOrderTrackingServer({ data: { orderId, createdAt } });
  if (remote) return remote;

  if (orderId.startsWith("PVT-LOCAL-") && createdAt) {
    return {
      order_id: orderId,
      status: simulateFallbackStatus(createdAt),
      carrier: "Pivoton Logistics",
      carrier_location: "Regional distribution hub",
    };
  }

  return null;
}

export async function fetchErpOrderHistory(): Promise<ShopOrder[]> {
  return fetchErpOrderHistoryServer();
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function decrementInventoryItem(
  items: ErpInventoryItem[],
  pivoton_sku: string,
  quantity = 1,
): ErpInventoryItem[] {
  return items.map((item) =>
    item.pivoton_sku === pivoton_sku
      ? { ...item, warehouse_stock: Math.max(0, item.warehouse_stock - quantity) }
      : item,
  );
}
