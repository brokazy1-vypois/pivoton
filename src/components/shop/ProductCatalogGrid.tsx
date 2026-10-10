import { memo, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import { optimizeProductImageUrl } from "@/lib/product-image";
import type { ErpInventoryItem } from "@/types/erp";

interface ProductCatalogGridProps {
  items: ErpInventoryItem[];
  loading?: boolean;
  onViewProduct: (item: ErpInventoryItem) => void;
  onCheckout: (item: ErpInventoryItem) => void;
}

const INITIAL_VISIBLE = 24;
const LOAD_MORE_STEP = 24;

const ProductCard = memo(function ProductCard({
  item,
  onViewProduct,
  onCheckout,
}: {
  item: ErpInventoryItem;
  onViewProduct: (item: ErpInventoryItem) => void;
  onCheckout: (item: ErpInventoryItem) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const inStock = item.warehouse_stock > 0;
  const imageUrl = item.image_url ? optimizeProductImageUrl(item.image_url) : null;
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onViewProduct(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewProduct(item);
        }
      }}
      className="panel cursor-pointer overflow-hidden transition-shadow [content-visibility:auto] [contain-intrinsic-size:320px] hover:ring-1 hover:ring-primary/25"
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-surface-2">
        {showImage ? (
          <img
            src={imageUrl!}
            alt={item.title}
            width={320}
            height={160}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Store className="h-7 w-7 text-muted-foreground" />
        )}
        <Badge className="absolute top-3 left-3 bg-gold text-gold-foreground hover:bg-gold">
          {item.category}
        </Badge>
        {!inStock && (
          <Badge variant="secondary" className="absolute top-3 right-3 bg-bear/20 text-bear">
            Out of stock
          </Badge>
        )}
      </div>
      <div className="p-6">
        <h2 className="line-clamp-2 text-sm font-medium">{item.title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {inStock ? `${item.warehouse_stock} in warehouse` : "Unavailable in warehouse"}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">{formatUsd(item.unit_price)}</span>
          <span className="text-xs text-primary">{item.cashback_percent}% back</span>
        </div>
        <Button
          className="mt-5 w-full"
          variant={inStock ? "secondary" : "outline"}
          size="sm"
          disabled={!inStock}
          onClick={(event) => {
            event.stopPropagation();
            onCheckout(item);
          }}
        >
          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
          {inStock ? "Pay with Pivoton" : "Out of stock"}
        </Button>
      </div>
    </div>
  );
});

export const ProductCatalogGrid = memo(function ProductCatalogGrid({
  items,
  loading,
  onViewProduct,
  onCheckout,
}: ProductCatalogGridProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [items]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + LOAD_MORE_STEP, items.length));
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  if (loading) {
    return (
      <div className="mt-8 flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Syncing partner catalog from Pivoton ERP…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="panel mt-8 p-8 text-center text-sm text-muted-foreground">
        No partner items are available right now. Try again shortly.
      </div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);

  return (
    <div className="mt-8">
      <p className="mb-4 text-sm text-muted-foreground">
        {items.length} SKUs synced from Affiliate ERP
        {visibleCount < items.length ? ` · showing ${visibleCount}` : ""}
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <ProductCard
            key={item.pivoton_sku}
            item={item}
            onViewProduct={onViewProduct}
            onCheckout={onCheckout}
          />
        ))}
      </div>
      {visibleCount < items.length ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
    </div>
  );
});
