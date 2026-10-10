import { fetchErpOrderTracking } from "@/lib/pivoton-erp";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ErpOrderStatus, PaymentMethod, ShippingInfo, ShopOrder } from "@/types/erp";
import type { SupabaseOrderRow } from "@/types/shop-commerce";

function normalizePaymentMethod(raw: string | null | undefined): PaymentMethod {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("credit")) return "credit";
  if (value.includes("nfc")) return "nfc";
  return "pivoton_balance";
}

function normalizeStatus(raw: string): ErpOrderStatus {
  const value = raw.toUpperCase().replace(/\s+/g, "_").replace(/DISPATCHED/, "SHIPPED");
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

function toShopOrder(row: SupabaseOrderRow): ShopOrder {
  const shipping = row.shipping_address ?? {};
  return {
    order_id: row.erp_order_id,
    created_at: row.created_at,
    items: [
      {
        pivoton_sku: row.pivoton_sku,
        title: row.product_name,
        quantity: 1,
        unit_price: row.total_price,
        cashback_percent: 0,
        image_url: row.product_image,
      },
    ],
    shipping_info: {
      full_name: shipping.full_name ?? shipping.customer_name ?? "",
      shipping_address: shipping.shipping_address ?? shipping.address ?? "",
      city: shipping.city ?? "",
      phone_number: shipping.phone_number ?? shipping.phone ?? "",
    },
    total_amount: row.total_price,
    cashback_received: 0,
    payment_method: normalizePaymentMethod(row.payment_method),
    status: normalizeStatus(row.status),
    tracking_number: row.tracking_number ?? undefined,
  };
}

export async function createSupabaseOrder(input: {
  user_id: string;
  erp_order_id: string;
  pivoton_sku: string;
  product_name: string;
  product_image?: string | null;
  total_price: number;
  payment_method: string;
  status: string;
  tracking_number?: string;
  shipping_info: ShippingInfo;
}): Promise<SupabaseOrderRow | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return null;

  const shipping_address = {
    full_name: input.shipping_info.full_name,
    shipping_address: input.shipping_info.shipping_address,
    city: input.shipping_info.city,
    phone_number: input.shipping_info.phone_number,
  };

  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id: input.user_id,
      erp_order_id: input.erp_order_id,
      pivoton_sku: input.pivoton_sku,
      product_name: input.product_name,
      product_image: input.product_image ?? null,
      total_price: input.total_price,
      payment_method: input.payment_method,
      status: input.status,
      tracking_number: input.tracking_number ?? null,
      shipping_address,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as SupabaseOrderRow;
}

export async function listSupabaseOrders(userId: string): Promise<ShopOrder[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as SupabaseOrderRow[]).map(toShopOrder);
}

export async function syncSupabaseOrderStatuses(userId: string): Promise<ShopOrder[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as SupabaseOrderRow[];
  const updated: SupabaseOrderRow[] = [];

  for (const row of rows) {
    if (row.status === "DELIVERED" || row.status === "CANCELLED") {
      updated.push(row);
      continue;
    }

    const remote = await fetchErpOrderTracking(row.erp_order_id, row.created_at);
    if (!remote) {
      updated.push(row);
      continue;
    }

    const nextStatus = remote.status;
    const nextTracking = remote.tracking_number ?? row.tracking_number;

    if (nextStatus !== row.status || nextTracking !== row.tracking_number) {
      const { data: patched } = await supabase
        .from("orders")
        .update({ status: nextStatus, tracking_number: nextTracking })
        .eq("id", row.id)
        .select("*")
        .single();

      updated.push((patched as SupabaseOrderRow) ?? { ...row, status: nextStatus, tracking_number: nextTracking });
    } else {
      updated.push(row);
    }
  }

  return updated.map(toShopOrder);
}

export async function updateSupabaseOrderByErpId(
  erpOrderId: string,
  patch: { status?: string; tracking_number?: string | null },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;

  await supabase
    .from("orders")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.tracking_number !== undefined
        ? { tracking_number: patch.tracking_number }
        : {}),
    })
    .eq("erp_order_id", erpOrderId);
}
