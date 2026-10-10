import type { ErpInventoryItem } from "@/types/erp";

interface ScoredProduct {
  item: ErpInventoryItem;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function scoreProduct(item: ErpInventoryItem, terms: string[]): number {
  const title = item.title.toLowerCase();
  const category = item.category.toLowerCase();
  const description = (item.description ?? "").toLowerCase();
  const sku = item.pivoton_sku.toLowerCase();
  const haystack = `${title} ${category} ${description} ${sku}`;

  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 24;
    if (category.includes(term)) score += 12;
    if (description.includes(term)) score += 8;
    if (haystack.includes(term)) score += 6;

    if (term.endsWith("s") && term.length > 4) {
      const singular = term.slice(0, -1);
      if (haystack.includes(singular)) score += 5;
    }

    if (term.length > 4) {
      const stem = term.slice(0, 4);
      if (tokenize(haystack).some((word) => word.startsWith(stem))) score += 3;
    }
  }

  if (item.warehouse_stock > 0) score += 2;

  return score;
}

export function searchMarketplaceProducts(
  catalog: ErpInventoryItem[],
  query: string,
  limit = 10,
): ErpInventoryItem[] {
  const terms = tokenize(query);
  if (terms.length === 0 || catalog.length === 0) return [];

  const ranked: ScoredProduct[] = catalog
    .map((item) => ({ item, score: scoreProduct(item, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    return ranked.slice(0, limit).map((entry) => entry.item);
  }

  // Soft fallback: return in-stock items from matching categories or partial title overlap
  const soft = catalog
    .map((item) => {
      const titleWords = tokenize(item.title);
      const overlap = terms.filter((term) =>
        titleWords.some((word) => word.includes(term) || term.includes(word)),
      ).length;
      return { item, score: overlap };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return soft.slice(0, limit).map((entry) => entry.item);
}
