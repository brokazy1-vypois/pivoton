import { fetchErpOrderHistory, fetchErpOrderTracking } from "@/lib/pivoton-erp";
import { updateSupabaseOrderByErpId } from "@/services/supabase-orders";
import type {
  ErpInventoryItem,
  ErpOrderStatus,
  OrderLineItem,
  PaymentMethod,
  PlaceOrderResponse,
  ShippingInfo,
  ShopOrder,
} from "@/types/erp";

const ORDERS_STORAGE_KEY = "pivoton-shop-orders";

function readLocalOrders(): ShopOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShopOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalOrders(orders: ShopOrder[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function cashbackAmount(total: number, percent: number): number {
  return Math.round(total * (percent / 100) * 100) / 100;
}

export function buildOrderLineItem(product: ErpInventoryItem, quantity = 1): OrderLineItem {
  return {
    pivoton_sku: product.pivoton_sku,
    title: product.title,
    quantity,
    unit_price: product.unit_price,
    cashback_percent: product.cashback_percent,
    image_url: product.image_url,
  };
}

export function saveLocalOrder(input: {
  response: PlaceOrderResponse;
  items: OrderLineItem[];
  shipping_info: ShippingInfo;
  total_amount: number;
  payment_method: PaymentMethod;
}): ShopOrder {
  const cashback_received = input.items.reduce(
    (sum, item) => sum + cashbackAmount(item.unit_price * item.quantity, item.cashback_percent),
    0,
  );

  const order: ShopOrder = {
    order_id: input.response.order_id,
    created_at: input.response.placed_at ?? new Date().toISOString(),
    items: input.items,
    shipping_info: input.shipping_info,
    total_amount: input.total_amount,
    cashback_received,
    payment_method: input.payment_method,
    status: input.response.status ?? "PROCESSING",
    tracking_number: input.response.tracking_number,
    carrier: "Pivoton Logistics",
    carrier_location: "Pivoton fulfillment hub",
    estimated_delivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const existing = readLocalOrders().filter((o) => o.order_id !== order.order_id);
  writeLocalOrders([order, ...existing]);
  return order;
}

export function getLocalOrder(orderId: string): ShopOrder | undefined {
  return readLocalOrders().find((order) => order.order_id === orderId);
}

export function updateLocalOrderStatus(orderId: string, patch: Partial<ShopOrder>) {
  const orders = readLocalOrders();
  const next = orders.map((order) =>
    order.order_id === orderId ? { ...order, ...patch } : order,
  );
  writeLocalOrders(next);
}

async function syncActiveOrderStatuses(orders: ShopOrder[]): Promise<ShopOrder[]> {
  return Promise.all(
    orders.map(async (order) => {
      if (order.status === "DELIVERED" || order.status === "CANCELLED") return order;
      const remote = await fetchErpOrderTracking(order.order_id, order.created_at);
      if (!remote) return order;

      const merged: ShopOrder = {
        ...order,
        status: remote.status,
        tracking_number: remote.tracking_number ?? order.tracking_number,
        carrier: remote.carrier ?? order.carrier,
        carrier_location: remote.carrier_location ?? order.carrier_location,
        estimated_delivery: remote.estimated_delivery ?? order.estimated_delivery,
        dispatched_at: remote.dispatched_at ?? order.dispatched_at,
      };
      updateLocalOrderStatus(order.order_id, merged);
      return merged;
    }),
  );
}

export async function listShopOrders(userId?: string): Promise<ShopOrder[]> {
  if (userId) {
    const { syncSupabaseOrderStatuses, listSupabaseOrders } = await import(
      "@/services/supabase-orders"
    );
    const supabaseOrders = await syncSupabaseOrderStatuses(userId);
    if (supabaseOrders.length > 0) return supabaseOrders;

    const rows = await listSupabaseOrders(userId);
    if (rows.length > 0) return rows;
  }

  const local = readLocalOrders();
  const remote = await fetchErpOrderHistory();

  const merged = new Map<string, ShopOrder>();
  for (const order of remote) merged.set(order.order_id, order);
  for (const order of local) {
    const existing = merged.get(order.order_id);
    merged.set(order.order_id, existing ? { ...existing, ...order } : order);
  }

  const sorted = [...merged.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return syncActiveOrderStatuses(sorted);
}

export async function syncOrderTracking(orderId: string): Promise<ShopOrder | undefined> {
  const local = getLocalOrder(orderId);
  const remote = await fetchErpOrderTracking(orderId, local?.created_at);

  if (!remote && !local) return undefined;

  const merged: ShopOrder = {
    ...(local ?? {
      order_id: orderId,
      created_at: new Date().toISOString(),
      items: [],
      shipping_info: {
        full_name: "",
        shipping_address: "",
        city: "",
        phone_number: "",
      },
      total_amount: 0,
      cashback_received: 0,
      payment_method: "pivoton_balance" as PaymentMethod,
      status: "ORDER_PLACED" as ErpOrderStatus,
    }),
    status: remote?.status ?? local?.status ?? "ORDER_PLACED",
    tracking_number: remote?.tracking_number ?? local?.tracking_number,
    carrier: remote?.carrier ?? local?.carrier,
    carrier_location: remote?.carrier_location ?? local?.carrier_location,
    estimated_delivery: remote?.estimated_delivery ?? local?.estimated_delivery,
    dispatched_at: remote?.dispatched_at ?? local?.dispatched_at,
  };

  if (remote) {
    await updateSupabaseOrderByErpId(orderId, {
      status: remote.status,
      tracking_number: remote.tracking_number ?? null,
    });
  }

  updateLocalOrderStatus(orderId, merged);
  return merged;
}
