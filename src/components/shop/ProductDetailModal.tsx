import { useState } from "react";
import { CreditCard, Loader2, Store, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import type { ErpInventoryItem } from "@/types/erp";

interface ProductDetailModalProps {
  product: ErpInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckout: (item: ErpInventoryItem) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onCheckout,
}: ProductDetailModalProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!product) return null;

  const inStock = product.warehouse_stock > 0;
  const showImage = Boolean(product.image_url) && !imageFailed;
  const description =
    product.description ??
    `${product.title} is supplied through Pivoton's Affiliate ERP partner network. Category: ${product.category}. SKU ${product.pivoton_sku}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-[#0B132B] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display pr-8 text-xl">{product.title}</DialogTitle>
          <DialogDescription>{product.category} · {product.pivoton_sku}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr]">
          <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface-2/40">
            {showImage ? (
              <img
                src={product.image_url!}
                alt={product.title}
                className="max-h-72 w-full object-contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Store className="h-10 w-10 text-muted-foreground" />
            )}
            <Badge className="absolute top-3 left-3 bg-gold text-gold-foreground hover:bg-gold">
              {product.category}
            </Badge>
            {!inStock && (
              <Badge variant="secondary" className="absolute top-3 right-3 bg-bear/20 text-bear">
                Out of stock
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
              <p className="font-display text-3xl font-semibold">{formatUsd(product.unit_price)}</p>
              <p className="mt-1 text-sm text-primary">{product.cashback_percent}% Pivoton cashback</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-[#0F172A]/50 p-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Warehouse stock</dt>
                <dd className="mt-1 font-medium">{inStock ? product.warehouse_stock : "Unavailable"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Fulfillment</dt>
                <dd className="mt-1 font-medium">Affiliate ERP</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">SKU</dt>
                <dd className="mt-1 font-mono text-xs">{product.pivoton_sku}</dd>
              </div>
            </dl>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" /> Close
          </Button>
          <Button
            type="button"
            className="bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
            disabled={!inStock}
            onClick={() => {
              onCheckout(product);
              onOpenChange(false);
            }}
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Pay with Pivoton
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductDetailModalSkeleton() {
  return (
    <div className="flex min-h-48 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading product…
    </div>
  );
}
