export type ErpOrderStatus =
  | "ORDER_PLACED"
  | "PROCESSING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentMethod = "pivoton_balance" | "credit" | "nfc";

export interface ErpInventoryItem {
  pivoton_sku: string;
  title: string;
  category: string;
  unit_price: number;
  cashback_percent: number;
  warehouse_stock: number;
  image_url?: string | null;
  description?: string | null;
}

export interface ShippingInfo {
  full_name: string;
  shipping_address: string;
  city: string;
  phone_number: string;
}

/** Affiliate ERP place-order body (pivoton-sync-flow). */
export interface AffiliatePlaceOrderPayload {
  api_key: string;
  pivoton_sku: string;
  quantity: number;
  total_price: number;
  shipping_details: {
    customer_name: string;
    address: string;
  };
}

export interface PlaceOrderInput {
  pivoton_sku: string;
  quantity: number;
  total_price: number;
  shipping_info: ShippingInfo;
  payment_method: PaymentMethod;
}

export interface PlaceOrderResponse {
  order_id: string;
  status?: ErpOrderStatus;
  tracking_number?: string;
  message?: string;
  fromFallback?: boolean;
  placed_at?: string;
}

export interface OrderLineItem {
  pivoton_sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  cashback_percent: number;
  image_url?: string | null;
}

export interface ShopOrder {
  order_id: string;
  created_at: string;
  items: OrderLineItem[];
  shipping_info: ShippingInfo;
  total_amount: number;
  cashback_received: number;
  payment_method: PaymentMethod;
  status: ErpOrderStatus;
  tracking_number?: string;
  carrier?: string;
  carrier_location?: string;
  estimated_delivery?: string;
  dispatched_at?: string;
}

export interface OrderTrackingUpdate {
  order_id: string;
  status: ErpOrderStatus;
  tracking_number?: string;
  carrier?: string;
  carrier_location?: string;
  estimated_delivery?: string;
  dispatched_at?: string;
}

export const ORDER_STATUS_STEPS: Array<{ key: ErpOrderStatus; label: string }> = [
  { key: "PROCESSING", label: "Processing at warehouse" },
  { key: "SHIPPED", label: "Dispatched from Pivoton warehouse" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "DELIVERED", label: "Delivered" },
];

export interface ErpInventoryResult {
  items: ErpInventoryItem[];
  fromFallback: boolean;
  warning?: string;
}
