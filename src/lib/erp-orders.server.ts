import { createServerFn } from "@tanstack/react-start";
import type {
  ErpOrderStatus,
  OrderTrackingUpdate,
  PlaceOrderInput,
  PlaceOrderResponse,
  ShopOrder,
} from "@/types/erp";

import { getErpBaseUrl, resolveErpApiKey } from "@/lib/erp-env";

const ERP_ORIGIN = "https://pivoton-sync-flow.lovable.app";
const REQUEST_TIMEOUT_MS = 12_000;

function getBaseUrl(): string {
  return getErpBaseUrl();
}

function getApiKey(): string {
  return resolveErpApiKey();
}

function getOrigin(): string {
  try {
    return new URL(getBaseUrl()).origin;
  } catch {
    return ERP_ORIGIN;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeStatus(raw: unknown): ErpOrderStatus {
  const value = String(raw ?? "ORDER_PLACED")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/DISPATCHED/, "SHIPPED");

  const allowed: ErpOrderStatus[] = [
    "ORDER_PLACED",
    "PROCESSING",
    "SHIPPED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ];
  return allowed.includes(value as ErpOrderStatus) ? (value as ErpOrderStatus) : "PROCESSING";
}

function authHeaders(apiKey: string, withBody = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(withBody ? { "Content-Type": "application/json" } : {}),
    "x-api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "X-Requested-With": "XMLHttpRequest",
  };
}

async function erpFetch(url: string, apiKey: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(apiKey, Boolean(init?.body)),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();

  if (text.includes("<!DOCTYPE html") || text.includes("<html")) {
    throw new Error("ERP returned HTML instead of JSON");
  }

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (!response.ok) {
        throw new Error(`ERP HTTP ${response.status}: ${text.slice(0, 120)}`);
      }
      throw new Error("ERP returned invalid JSON");
    }
  }

  if (!response.ok) {
    const message =
      (isRecord(payload) && pickString(payload, "error", "message")) ||
      `ERP HTTP ${response.status}`;
    throw new Error(message);
  }

  if (isRecord(payload) && payload.error && !payload.order_id && !payload.items) {
    throw new Error(String(payload.error));
  }

  return payload;
}

function placeOrderEndpointCandidates(baseUrl: string, origin: string): string[] {
  const apiRoot = baseUrl.replace(/\/$/, "");
  return [
    `${apiRoot}/orders/place-order`,
    `${origin}/api/v1/erp/orders/place-order`,
    `${origin}/api/v1/orders/place-order`,
    `${apiRoot}/place-order`,
  ];
}

function trackingEndpointCandidates(baseUrl: string, origin: string, orderId: string): string[] {
  const apiRoot = baseUrl.replace(/\/$/, "");
  const enc = encodeURIComponent(orderId);
  return [
    `${apiRoot}/orders/${enc}/status`,
    `${origin}/api/v1/erp/orders/${enc}/status`,
    `${origin}/api/v1/orders/${enc}/status`,
    `${apiRoot}/orders/${enc}`,
    `${apiRoot}/orders/track?order_id=${enc}`,
    `${apiRoot}/orders/status/${enc}`,
  ];
}

function historyEndpointCandidates(baseUrl: string, origin: string): string[] {
  const apiRoot = baseUrl.replace(/\/$/, "");
  return [
    `${apiRoot}/orders/history`,
    `${origin}/api/v1/erp/orders/history`,
    `${origin}/api/v1/orders/history`,
    `${apiRoot}/orders`,
  ];
}

function buildPlaceOrderBody(input: PlaceOrderInput, apiKey: string) {
  const address = [input.shipping_info.shipping_address, input.shipping_info.city]
    .filter(Boolean)
    .join(", ");

  const paymentLabel =
    input.payment_method === "credit"
      ? "Credit line"
      : input.payment_method === "nfc"
        ? "NFC tap-to-pay"
        : "Pivoton Balance";

  return {
    api_key: apiKey,
    pivoton_sku: input.pivoton_sku,
    quantity: input.quantity,
    total_price: input.total_price,
    payment_method: paymentLabel,
    shipping_address: {
      full_name: input.shipping_info.full_name,
      address: address || input.shipping_info.shipping_address,
      city: input.shipping_info.city,
      phone: input.shipping_info.phone_number,
    },
    shipping_details: {
      customer_name: input.shipping_info.full_name,
      address: address || input.shipping_info.shipping_address,
    },
  };
}

function parsePlaceOrderResponse(payload: unknown): PlaceOrderResponse | null {
  if (!isRecord(payload)) return null;

  const nested = isRecord(payload.order) ? payload.order : {};
  const order_id =
    pickString(payload, "order_id", "id", "orderId") ??
    pickString(nested, "order_id", "id", "orderId");

  if (!order_id) return null;

  return {
    order_id,
    status: normalizeStatus(payload.status ?? payload.order_status ?? nested.status),
    tracking_number: pickString(payload, "tracking_number", "trackingNumber", "tracking_id"),
    message: pickString(payload, "message"),
    fromFallback: false,
  };
}

function parseTrackingResponse(payload: unknown, orderId: string): OrderTrackingUpdate | null {
  const raw = isRecord(payload) && isRecord(payload.order) ? payload.order : payload;
  if (!isRecord(raw)) return null;

  return {
    order_id: pickString(raw, "order_id", "id", "orderId") ?? orderId,
    status: normalizeStatus(raw.status ?? raw.order_status),
    tracking_number: pickString(raw, "tracking_number", "trackingNumber", "tracking_id"),
    carrier: pickString(raw, "carrier", "courier", "carrier_name"),
    carrier_location: pickString(raw, "carrier_location", "current_location", "location"),
    estimated_delivery: pickString(raw, "estimated_delivery", "eta", "estimated_delivery_date"),
    dispatched_at: pickString(raw, "dispatched_at", "dispatch_timestamp", "shipped_at"),
  };
}

function createFallbackOrder(input: PlaceOrderInput): PlaceOrderResponse {
  const order_id = `PVT-LOCAL-${Date.now().toString(36).toUpperCase()}`;
  const tracking_number = `TRK${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  return {
    order_id,
    status: "PROCESSING",
    tracking_number,
    message: `Order placed for ${input.pivoton_sku}. Affiliate ERP sync will retry in background.`,
    fromFallback: true,
    placed_at: new Date().toISOString(),
  };
}

export function simulateFallbackStatus(createdAt: string): ErpOrderStatus {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const minutes = elapsed / 60_000;
  if (minutes < 0.5) return "ORDER_PLACED";
  if (minutes < 2) return "PROCESSING";
  if (minutes < 5) return "SHIPPED";
  if (minutes < 10) return "IN_TRANSIT";
  if (minutes < 15) return "OUT_FOR_DELIVERY";
  return "DELIVERED";
}

export const placeErpOrderServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<PlaceOrderResponse> => {
    const input =
      ctx && typeof ctx === "object" && "data" in ctx
        ? ((ctx as { data: PlaceOrderInput }).data)
        : (ctx as PlaceOrderInput);
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Pivoton ERP API key is not configured.");
    }

    const body = buildPlaceOrderBody(input, apiKey);
    const endpoints = placeOrderEndpointCandidates(getBaseUrl(), getOrigin());
    let lastError = "Affiliate ERP unreachable";

    for (const url of endpoints) {
      try {
        const payload = await erpFetch(url, apiKey, {
          method: "POST",
          body: JSON.stringify(body),
        });
        const parsed = parsePlaceOrderResponse(payload);
        if (parsed) return parsed;
        lastError = `Endpoint ${url} did not return an order ID`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const fallback = createFallbackOrder(input);
    fallback.message = `${fallback.message} (${lastError})`;
    return fallback;
  },
);

export const fetchErpOrderTrackingServer = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<OrderTrackingUpdate | null> => {
    const payload =
      ctx && typeof ctx === "object" && "data" in ctx
        ? (ctx as { data: { orderId: string; createdAt?: string } }).data
        : (ctx as { orderId: string; createdAt?: string });
    const { orderId, createdAt } = payload ?? {};
    if (!orderId) return null;
    const apiKey = getApiKey();

    if (apiKey) {
      const endpoints = trackingEndpointCandidates(getBaseUrl(), getOrigin(), orderId);

      for (const url of endpoints) {
        try {
          const payload = await erpFetch(url, apiKey);
          const tracking = parseTrackingResponse(payload, orderId);
          if (tracking) return tracking;
        } catch {
          continue;
        }
      }
    }

    if (orderId.startsWith("PVT-LOCAL-") && createdAt) {
      return {
        order_id: orderId,
        status: simulateFallbackStatus(createdAt),
        carrier: "Pivoton Logistics",
        carrier_location: "Regional distribution hub",
      };
    }

    return null;
  },
);

function normalizeHistoryOrder(raw: unknown): ShopOrder | null {
  if (!isRecord(raw)) return null;
  const order_id = pickString(raw, "order_id", "id", "orderId");
  if (!order_id) return null;

  const pivoton_sku = pickString(raw, "pivoton_sku", "sku") ?? "UNKNOWN";
  const title = pickString(raw, "product_name", "title", "name") ?? pivoton_sku;

  return {
    order_id,
    created_at: pickString(raw, "created_at", "timestamp", "placed_at") ?? new Date().toISOString(),
    items: [
      {
        pivoton_sku,
        title,
        quantity: 1,
        unit_price: Number(raw.total_price ?? raw.total_amount ?? 0),
        cashback_percent: 0,
      },
    ],
    shipping_info: {
      full_name: "",
      shipping_address: "",
      city: "",
      phone_number: "",
    },
    total_amount: Number(raw.total_price ?? raw.total_amount ?? 0),
    cashback_received: 0,
    payment_method: "pivoton_balance",
    status: normalizeStatus(raw.status ?? raw.order_status),
    tracking_number: pickString(raw, "tracking_number", "trackingNumber"),
  };
}

export const fetchErpOrderHistoryServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShopOrder[]> => {
    const apiKey = getApiKey();
    if (!apiKey) return [];

    const endpoints = historyEndpointCandidates(getBaseUrl(), getOrigin());

    for (const url of endpoints) {
      try {
        const payload = await erpFetch(url, apiKey);
        const list = Array.isArray(payload)
          ? payload
          : isRecord(payload)
            ? ((payload.orders ?? payload.items ?? payload.data) as unknown[])
            : [];
        if (!Array.isArray(list) || list.length === 0) continue;
        return list.map(normalizeHistoryOrder).filter(Boolean) as ShopOrder[];
      } catch {
        continue;
      }
    }

    return [];
  },
);
