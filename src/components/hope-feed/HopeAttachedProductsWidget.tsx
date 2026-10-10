import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Package, ShoppingBag, Store } from "lucide-react";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import { cn } from "@/lib/utils";
import type { ErpInventoryItem } from "@/types/erp";

const VIEWPORT_HEIGHT_PX = 88;
const ITEM_HEIGHT_PX = 72;
const EDGE_PAD_PX = (VIEWPORT_HEIGHT_PX - ITEM_HEIGHT_PX) / 2;

interface HopeAttachedProductsWidgetProps {
  products: ErpInventoryItem[];
  className?: string;
}

function focusStyles(strength: number) {
  const clamped = Math.max(0, Math.min(1, strength));
  return {
    opacity: 0.35 + clamped * 0.65,
    transform: `scale(${0.85 + clamped * 0.15})`,
    filter: clamped < 0.55 ? `blur(${(1 - clamped) * 1.5}px)` : "none",
  } as const;
}

function AttachedProductRow({
  product,
  focusStrength,
  onOpenDetail,
}: {
  product: ErpInventoryItem;
  focusStrength: number;
  onOpenDetail: (product: ErpInventoryItem) => void;
}) {
  const inStock = product.warehouse_stock > 0;
  const isFocused = focusStrength >= 0.55;
  const visuals = focusStyles(focusStrength);

  return (
    <div
      data-carousel-item
      className={cn(
        "flex h-[72px] shrink-0 snap-center gap-2 rounded-md border border-border/50 bg-[#0B132B]/80 p-2 transition-[transform,opacity,filter] duration-200 ease-out",
        isFocused ? "border-primary/30" : "border-border/40",
      )}
      style={visuals}
    >
      <button
        type="button"
        onClick={() => isFocused && onOpenDetail(product)}
        tabIndex={isFocused ? 0 : -1}
        className={cn(
          "relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2",
          !isFocused && "pointer-events-none",
        )}
        aria-label={`View ${product.title}`}
        aria-hidden={!isFocused}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            className="h-12 w-12 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </button>
      <div className={cn("min-w-0 flex-1", !isFocused && "pointer-events-none")}>
        <button
          type="button"
          onClick={() => isFocused && onOpenDetail(product)}
          tabIndex={isFocused ? 0 : -1}
          className={cn(
            "line-clamp-1 w-full text-left text-[11px] font-medium leading-snug",
            isFocused && "hover:text-primary",
          )}
          aria-hidden={!isFocused}
        >
          {product.title}
        </button>
        <p className="mt-0.5 font-display text-xs font-semibold text-primary">
          {formatUsd(product.unit_price)}
        </p>
        <div className="mt-1 flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-6 flex-1 px-1.5 text-[10px]"
            disabled={!inStock || !isFocused}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => onOpenDetail(product)}
          >
            View
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-6 flex-1 px-1.5 text-[10px]"
            disabled={!inStock || !isFocused}
            tabIndex={isFocused ? 0 : -1}
          >
            <Link
              to="/shop"
              search={{ tab: "shopping", sku: product.pivoton_sku }}
              aria-hidden={!isFocused}
              tabIndex={isFocused ? 0 : -1}
            >
              <ShoppingBag className="mr-0.5 h-3 w-3" />
              Buy
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function useCarouselFocusStrengths(itemCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [strengths, setStrengths] = useState<number[]>(() => Array(itemCount).fill(1));

  const updateStrengths = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const viewportCenter = container.scrollTop + container.clientHeight / 2;
    const next = Array.from(container.querySelectorAll<HTMLElement>("[data-carousel-item]")).map(
      (item) => {
        const itemCenter = item.offsetTop + item.offsetHeight / 2;
        const distance = Math.abs(viewportCenter - itemCenter);
        const falloff = container.clientHeight / 2;
        return Math.max(0, 1 - distance / falloff);
      },
    );

    setStrengths(next.length > 0 ? next : Array(itemCount).fill(1));
  }, [itemCount]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    updateStrengths();
    container.addEventListener("scroll", updateStrengths, { passive: true });
    window.addEventListener("resize", updateStrengths);

    return () => {
      container.removeEventListener("scroll", updateStrengths);
      window.removeEventListener("resize", updateStrengths);
    };
  }, [updateStrengths, itemCount]);

  return { scrollRef, strengths };
}

export function HopeAttachedProductsWidget({ products, className }: HopeAttachedProductsWidgetProps) {
  const navigate = useNavigate();
  const [detailProduct, setDetailProduct] = useState<ErpInventoryItem | null>(null);
  const { scrollRef, strengths } = useCarouselFocusStrengths(products.length);

  if (products.length === 0) return null;

  const canScroll = products.length > 1;

  return (
    <>
      <div
        className={cn(
          "flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:w-[280px]",
          className,
        )}
      >
        <div className="mb-2 flex items-center gap-1.5 border-b border-border/50 pb-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Attached products ({products.length})
          </p>
        </div>

        <div className="relative h-[88px] shrink-0">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-[#0f172a]/95 via-[#0f172a]/60 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-[#0f172a]/95 via-[#0f172a]/60 to-transparent"
            aria-hidden
          />

          <div
            ref={scrollRef}
            className={cn(
              "custom-scrollbar h-[88px] overflow-y-auto overscroll-contain scroll-smooth",
              canScroll && "snap-y snap-mandatory",
            )}
            style={{
              paddingTop: EDGE_PAD_PX,
              paddingBottom: EDGE_PAD_PX,
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
            }}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              {products.map((product, index) => (
                <AttachedProductRow
                  key={product.pivoton_sku}
                  product={product}
                  focusStrength={strengths[index] ?? (index === 0 ? 1 : 0.35)}
                  onOpenDetail={setDetailProduct}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ProductDetailModal
        product={detailProduct}
        open={detailProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDetailProduct(null);
        }}
        onCheckout={(item) => {
          setDetailProduct(null);
          void navigate({ to: "/shop", search: { tab: "shopping", sku: item.pivoton_sku } });
        }}
      />
    </>
  );
}
