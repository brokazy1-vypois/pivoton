/** Parse marketplace product references embedded in hope feed post text. */

const SHOP_PATH_PATTERN = /(?:https?:\/\/[^\s/]+)?\/shop[^\s]*/gi;
const SKU_QUERY_PATTERN = /[?&](?:sku|product)=([^&\s#]+)/i;

export function extractShopProductSkus(content: string): string[] {
  const skus = new Set<string>();
  const matches = content.match(SHOP_PATH_PATTERN) ?? [];

  for (const raw of matches) {
    const skuMatch = raw.match(SKU_QUERY_PATTERN);
    if (skuMatch?.[1]) {
      skus.add(decodeURIComponent(skuMatch[1]).trim());
    }
  }

  return [...skus];
}

export function stripShopUrlsFromContent(content: string): string {
  return content
    .replace(SHOP_PATH_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildShopProductUrl(sku: string, origin = ""): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/shop?tab=shopping&sku=${encodeURIComponent(sku)}`;
}

export function extractMarketplaceLink(content: string): string | null {
  const links = extractMarketplaceLinks(content);
  return links[0] ?? null;
}

export function extractMarketplaceLinks(content: string): string[] {
  const matches = content.match(SHOP_PATH_PATTERN) ?? [];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const links: string[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const trimmed = raw.trim();
    const normalized = trimmed.startsWith("http")
      ? trimmed
      : `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;

    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
}
