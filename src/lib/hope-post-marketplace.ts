import type { HopePost } from "@/types/hope-post";
import { extractMarketplaceLinks, extractShopProductSkus } from "@/lib/shop-link-parser";

function parseMarketplaceLinksField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [value];
    }
  }
  return [];
}

/** Collect every marketplace link stored on a post (array field, legacy single link, body text). */
export function resolvePostMarketplaceLinks(
  post: Pick<HopePost, "content" | "marketplace_link" | "marketplace_links">,
): string[] {
  const seen = new Set<string>();
  const links: string[] = [];

  const addLink = (link: string) => {
    const trimmed = link.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    links.push(trimmed);
  };

  for (const link of post.marketplace_links ?? []) addLink(link);
  if (post.marketplace_link) addLink(post.marketplace_link);
  for (const link of extractMarketplaceLinks(post.content)) addLink(link);

  return links;
}

/** Unique product SKUs attached to a hope post, in display order. */
export function resolvePostProductSkus(
  post: Pick<HopePost, "content" | "marketplace_link" | "marketplace_links">,
): string[] {
  const skus: string[] = [];
  const seen = new Set<string>();

  const addFromText = (text: string) => {
    for (const sku of extractShopProductSkus(text)) {
      const normalized = sku.trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      skus.push(normalized);
    }
  };

  for (const link of resolvePostMarketplaceLinks(post)) addFromText(link);
  addFromText(post.content);

  return skus;
}

export function parseMarketplaceLinksFromRow(row: Record<string, unknown>): string[] {
  const fromArray = parseMarketplaceLinksField(row.marketplace_links);
  if (fromArray.length > 0) return fromArray;
  if (row.marketplace_link) return [String(row.marketplace_link)];
  return [];
}
