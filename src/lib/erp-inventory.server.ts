import { createServerFn } from "@tanstack/react-start";
import { SEED_ERP_CATALOG } from "@/data/seed-erp-catalog";
import type { ErpInventoryItem, ErpInventoryResult } from "@/types/erp";
import {
  INVENTORY_PAGE_SIZE,
  extractInventoryList,
  extractInventoryTotal,
  extractRawInventoryRows,
  inventoryEndpointCandidates,
  withInventoryPagination,
} from "@/lib/erp-product-mapper";
import {
  getConfiguredErpApiKey,
  getErpBaseUrl,
  isErpDemoApiKey,
} from "@/lib/erp-env";

const DUMMYJSON_CATALOG = "https://dummyjson.com/products";

function getBaseUrl(): string {
  return getErpBaseUrl();
}

function getOrigin(): string {
  try {
    return new URL(getBaseUrl()).origin;
  } catch {
    return "https://pivoton-sync-flow.lovable.app";
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
}

async function fetchJson(url: string, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: authHeaders(apiKey),
    signal: AbortSignal.timeout(12_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }

  if (text.includes("<!DOCTYPE html") || text.includes("<html")) {
    throw new Error("ERP returned HTML instead of JSON");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("ERP returned invalid JSON");
  }
}

async function fetchAllFromEndpoint(baseEndpoint: string, apiKey: string): Promise<ErpInventoryItem[]> {
  const collected: ErpInventoryItem[] = [];
  let page = 1;

  while (page <= 5) {
    const url = withInventoryPagination(baseEndpoint, page);
    const payload = await fetchJson(url, apiKey);
    const batch = extractInventoryList(payload);
    if (batch.length === 0) break;

    collected.push(...batch);

    const total = extractInventoryTotal(payload, collected.length);
    if (collected.length >= total || batch.length < INVENTORY_PAGE_SIZE) break;
    page += 1;
  }

  return dedupeBySku(collected);
}

async function fetchDummyJsonCatalog(): Promise<ErpInventoryItem[]> {
  const url = withInventoryPagination(`${DUMMYJSON_CATALOG}?limit=${INVENTORY_PAGE_SIZE}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`DummyJSON HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  return extractInventoryList(payload);
}

function dedupeBySku(items: ErpInventoryItem[]): ErpInventoryItem[] {
  const map = new Map<string, ErpInventoryItem>();
  for (const item of items) {
    map.set(item.pivoton_sku, item);
  }
  return [...map.values()];
}

async function loadPublicCatalogMirror(): Promise<ErpInventoryItem[]> {
  try {
    const items = await fetchDummyJsonCatalog();
    if (items.length > 0) return items;
  } catch {
    // fall through to seed catalog
  }
  return SEED_ERP_CATALOG;
}

export const fetchErpInventoryServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<ErpInventoryResult> => {
    const apiKey = getConfiguredErpApiKey();
    const origin = getOrigin();
    const endpoints = inventoryEndpointCandidates(getBaseUrl(), origin);

    if (apiKey && !isErpDemoApiKey()) {
      for (const endpoint of endpoints) {
        try {
          const items = await fetchAllFromEndpoint(endpoint, apiKey);
          if (items.length > 0) {
            return { items, fromFallback: false };
          }
        } catch {
          // try next endpoint
        }
      }

      const items = await loadPublicCatalogMirror();
      return { items, fromFallback: true };
    }

    const items = await loadPublicCatalogMirror();
    return { items, fromFallback: true };
  },
);

/** Used in tests / debugging — count raw rows without full normalization. */
export function countRawRows(payload: unknown): number {
  return extractRawInventoryRows(payload).length;
}
