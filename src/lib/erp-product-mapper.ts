import type { ErpInventoryItem } from "@/types/erp";

const INVENTORY_PAGE_SIZE = 100;

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

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

/** Resolve image URL from common ERP / marketplace payload shapes. */
export function pickImageUrl(raw: Record<string, unknown>): string | null {
  const direct = pickString(
    raw,
    "image_url",
    "imageUrl",
    "image",
    "thumbnail",
    "thumb",
    "product_image",
    "productImage",
    "photo",
    "picture",
  );
  if (direct) return direct;

  const images = raw.images;
  if (Array.isArray(images)) {
    for (const entry of images) {
      if (typeof entry === "string" && entry.trim()) return entry.trim();
      if (isRecord(entry)) {
        const nested = pickString(entry, "url", "src", "image", "thumbnail");
        if (nested) return nested;
      }
    }
  }

  if (isRecord(raw.media)) {
    const mediaUrl = pickString(raw.media, "url", "src", "thumbnail");
    if (mediaUrl) return mediaUrl;
  }

  return null;
}

function formatCategory(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .trim()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (isRecord(raw)) {
    const name = pickString(raw, "name", "title", "label");
    if (name) return formatCategory(name);
  }
  return "Ecommerce";
}

function deriveCashbackPercent(raw: Record<string, unknown>): number {
  const explicit = pickNumber(raw, "cashback_percent", "cashback_pct", "cashback");
  if (explicit !== undefined) return Math.max(0, Math.min(100, explicit));

  const discount = pickNumber(raw, "discountPercentage", "discount_percent", "discount");
  if (discount !== undefined) return Math.max(1, Math.min(15, Math.round(discount)));

  return 3;
}

function normalizeSku(raw: Record<string, unknown>, fallbackIndex: number): string {
  const sku = pickString(raw, "pivoton_sku", "sku", "code", "id");
  if (!sku) return `PVT-SKU-${fallbackIndex + 1}`;

  const normalized = sku.toUpperCase();
  if (normalized.startsWith("PVT-") || normalized.startsWith("SKU-")) return sku;
  return `PVT-${sku}`;
}

export function normalizeInventoryItem(raw: unknown, index = 0): ErpInventoryItem | null {
  if (!isRecord(raw)) return null;

  const pivoton_sku = normalizeSku(raw, index);
  const title =
    pickString(raw, "title", "name", "product_name", "productName") ??
    pickString(raw, "description")?.slice(0, 80);

  if (!title) return null;

  const stock =
    pickNumber(raw, "warehouse_stock", "stock", "quantity", "inventory", "qty_on_hand") ?? 0;

  return {
    pivoton_sku,
    title,
    category: formatCategory(raw.category ?? raw.categoryName ?? raw.type ?? raw.provider),
    unit_price: pickNumber(raw, "unit_price", "price", "selling_price", "total_price", "cost") ?? 0,
    cashback_percent: deriveCashbackPercent(raw),
    warehouse_stock: Math.max(0, Math.round(stock)),
    image_url: pickImageUrl(raw),
    description: pickString(raw, "description", "short_description"),
  };
}

export function extractRawInventoryRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const nested =
    payload.products ??
    payload.items ??
    payload.inventory ??
    payload.data ??
    payload.results;

  if (Array.isArray(nested)) return nested;
  if (isRecord(nested) && Array.isArray(nested.items)) return nested.items;
  return [];
}

export function extractInventoryList(payload: unknown): ErpInventoryItem[] {
  return extractRawInventoryRows(payload)
    .map((row, index) => normalizeInventoryItem(row, index))
    .filter(Boolean) as ErpInventoryItem[];
}

export function extractInventoryTotal(payload: unknown, fallback = 0): number {
  if (!isRecord(payload)) return fallback;
  return (
    pickNumber(payload, "total", "count", "total_count") ??
    (isRecord(payload.meta) ? pickNumber(payload.meta, "total") : undefined) ??
    extractRawInventoryRows(payload).length ??
    fallback
  );
}

export function withInventoryPagination(url: string, page = 1): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("limit")) {
    parsed.searchParams.set("limit", String(INVENTORY_PAGE_SIZE));
  }
  if (!parsed.searchParams.has("per_page")) {
    parsed.searchParams.set("per_page", String(INVENTORY_PAGE_SIZE));
  }
  if (page > 1) {
    parsed.searchParams.set("page", String(page));
  }
  return parsed.toString();
}

export function inventoryEndpointCandidates(baseUrl: string, origin: string): string[] {
  const apiRoot = baseUrl.replace(/\/$/, "");
  return [
    `${apiRoot}/products`,
    `${apiRoot}/inventory`,
    `${origin}/api/v1/products`,
    `${origin}/api/v1/erp/inventory`,
    `${origin}/inventory`,
  ];
}

export { INVENTORY_PAGE_SIZE };
