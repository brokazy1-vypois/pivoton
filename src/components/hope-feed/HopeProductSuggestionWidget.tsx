import { Link } from "@tanstack/react-router";
import { Plus, ShoppingBag, Sparkles, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import { cn } from "@/lib/utils";
import type { ErpInventoryItem } from "@/types/erp";

interface HopeProductSuggestionWidgetProps {
  visible: boolean;
  loading: boolean;
  query: string | null;
  products: ErpInventoryItem[];
  attachedSkus: Set<string>;
  onAttach: (product: ErpInventoryItem) => void;
  className?: string;
}

function SuggestionSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex gap-2 rounded-md border border-border/40 p-2">
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionRow({
  product,
  attached,
  onAttach,
}: {
  product: ErpInventoryItem;
  attached: boolean;
  onAttach: (product: ErpInventoryItem) => void;
}) {
  const inStock = product.warehouse_stock > 0;

  return (
    <div className="flex gap-2 rounded-md border border-border/50 bg-[#0B132B]/80 p-2 transition-colors hover:border-primary/30">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] font-medium leading-snug">{product.title}</p>
        <p className="mt-0.5 font-display text-xs font-semibold text-primary">
          {formatUsd(product.unit_price)}
        </p>
        <div className="mt-1.5 flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-6 flex-1 px-1.5 text-[10px]"
            disabled={!inStock || attached}
            onClick={() => onAttach(product)}
          >
            <Plus className="mr-0.5 h-3 w-3" />
            {attached ? "Attached" : "Attach"}
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-6 flex-1 px-1.5 text-[10px]"
            disabled={!inStock}
          >
            <Link to="/shop" search={{ tab: "shopping", sku: product.pivoton_sku }}>
              <ShoppingBag className="mr-0.5 h-3 w-3" />
              Buy
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HopeProductSuggestionWidget({
  visible,
  loading,
  query,
  products,
  attachedSkus,
  onAttach,
  className,
}: HopeProductSuggestionWidgetProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-primary/25 bg-[#0F172A]/95 shadow-lg shadow-black/20 backdrop-blur-sm",
        className,
      )}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {loading ? "Finding matches…" : `Matches for “${query}”`}
        </p>
      </div>

      <div className="custom-scrollbar max-h-[168px] overflow-y-auto overscroll-contain p-1.5">
        {loading ? (
          <SuggestionSkeleton />
        ) : products.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No marketplace items matched. Try naming a product category.
          </p>
        ) : (
          <div className="space-y-1.5">
            {products.map((product) => (
              <SuggestionRow
                key={product.pivoton_sku}
                product={product}
                attached={attachedSkus.has(product.pivoton_sku)}
                onAttach={onAttach}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
