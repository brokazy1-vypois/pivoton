import { Link } from "@tanstack/react-router";
import { CreditCard, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import type { ErpInventoryItem } from "@/types/erp";

interface MarketplaceProductBriefProps {
  product: ErpInventoryItem;
}

export function MarketplaceProductBrief({ product }: MarketplaceProductBriefProps) {
  const inStock = product.warehouse_stock > 0;

  return (
    <div className="flex min-w-[200px] max-w-[240px] flex-1 gap-3 rounded-lg border border-border/60 bg-[#0F172A]/60 p-2.5">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Store className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-medium leading-snug">{product.title}</p>
        <p className="mt-1 font-display text-sm font-semibold">{formatUsd(product.unit_price)}</p>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="mt-2 h-7 w-full px-2 text-[10px]"
          disabled={!inStock}
        >
          <Link
            to="/shop"
            search={{ tab: "shopping", sku: product.pivoton_sku }}
          >
            <CreditCard className="mr-1 h-3 w-3" />
            Pay with Pivoton
          </Link>
        </Button>
      </div>
    </div>
  );
}
