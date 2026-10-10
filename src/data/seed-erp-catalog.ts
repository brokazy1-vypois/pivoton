import type { ErpInventoryItem } from "@/types/erp";

/** Fallback catalog when Pivoton ERP is unreachable or auth fails. */
export const SEED_ERP_CATALOG: ErpInventoryItem[] = [
  {
    pivoton_sku: "PVT-SKU-HPH-001",
    title: "Noise-cancelling headphones",
    category: "Ecommerce",
    unit_price: 249,
    cashback_percent: 3,
    warehouse_stock: 18,
    image_url: null,
  },
  {
    pivoton_sku: "PVT-SKU-GRC-002",
    title: "Weekly grocery delivery",
    category: "Delivery",
    unit_price: 68,
    cashback_percent: 5,
    warehouse_stock: 42,
    image_url: null,
  },
  {
    pivoton_sku: "PVT-SKU-CFA-003",
    title: "CFA Level I prep course",
    category: "Edtech",
    unit_price: 399,
    cashback_percent: 8,
    warehouse_stock: 9,
    image_url: null,
  },
  {
    pivoton_sku: "PVT-SKU-EVR-004",
    title: "EV weekend rental",
    category: "Car",
    unit_price: 180,
    cashback_percent: 4,
    warehouse_stock: 6,
    image_url: null,
  },
  {
    pivoton_sku: "PVT-SKU-RLS-005",
    title: "Downtown studio — 12mo lease",
    category: "Real estate",
    unit_price: 1450,
    cashback_percent: 1,
    warehouse_stock: 2,
    image_url: null,
  },
  {
    pivoton_sku: "PVT-SKU-DSK-006",
    title: "Standing desk, oak top",
    category: "Ecommerce",
    unit_price: 520,
    cashback_percent: 3,
    warehouse_stock: 0,
    image_url: null,
  },
];
