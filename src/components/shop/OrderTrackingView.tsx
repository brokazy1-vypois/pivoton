import { Check, Loader2, MapPin, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/pivoton-erp";
import { ORDER_STATUS_STEPS, type ErpOrderStatus, type ShopOrder } from "@/types/erp";
import { cn } from "@/lib/utils";

function stepIndex(status: ErpOrderStatus): number {
  if (status === "ORDER_PLACED") return 0;
  if (status === "OUT_FOR_DELIVERY") {
    const transitIdx = ORDER_STATUS_STEPS.findIndex((step) => step.key === "IN_TRANSIT");
    return transitIdx >= 0 ? transitIdx : ORDER_STATUS_STEPS.length - 2;
  }
  const idx = ORDER_STATUS_STEPS.findIndex((step) => step.key === status);
  return idx >= 0 ? idx : 0;
}

interface OrderTrackingViewProps {
  order: ShopOrder;
  syncing?: boolean;
  compact?: boolean;
}

export function OrderTrackingView({ order, syncing, compact }: OrderTrackingViewProps) {
  const activeStep = stepIndex(order.status);
  const primaryItem = order.items[0];

  return (
    <div className={cn("space-y-8", compact && "space-y-5")}>
      <div className={cn(!compact && "panel p-6 sm:p-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {!compact && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
            )}
            <h2 className={cn("font-display font-semibold", compact ? "text-lg" : "mt-1 text-2xl")}>
              {order.order_id}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Placed {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-primary">
              {formatUsd(order.total_amount)}
            </p>
            {syncing && (
              <p className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Syncing with ERP…
              </p>
            )}
          </div>
        </div>

        {primaryItem && (
          <div className="mt-4 rounded-lg border border-border bg-[#0B0E14] p-4">
            <p className="text-sm font-medium">{primaryItem.title}</p>
            <p className="text-xs text-muted-foreground">{primaryItem.pivoton_sku}</p>
          </div>
        )}
      </div>

      <div className={cn(!compact && "panel p-6 sm:p-8")}>
        <h3 className="font-display text-base font-semibold">Fulfillment progress</h3>
        <div className={cn("mt-6 space-y-0", compact && "mt-4")}>
          {ORDER_STATUS_STEPS.map((step, index) => {
            const complete = index <= activeStep;
            const current = index === activeStep;
            return (
              <div key={step.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border",
                      complete
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                        : "border-border bg-surface-2 text-muted-foreground",
                    )}
                  >
                    {complete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>
                  {index < ORDER_STATUS_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "my-1 min-h-8 w-px flex-1",
                        index < activeStep ? "bg-emerald-500/60" : "bg-border",
                      )}
                    />
                  )}
                </div>
                <div className="pb-6 pt-1">
                  <p className={cn("text-sm font-medium", current && "text-primary")}>
                    {step.label}
                  </p>
                  {current && (
                    <Badge variant="outline" className="mt-2 border-emerald-500/30 text-emerald-400">
                      Current
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn("grid gap-6", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
        <div className={cn(!compact && "panel p-6", compact && "rounded-lg border border-border p-4")}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Package metadata</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tracking number</dt>
              <dd className="font-medium">{order.tracking_number ?? "Pending assignment"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dispatch time</dt>
              <dd className="font-medium">
                {order.dispatched_at
                  ? new Date(order.dispatched_at).toLocaleString()
                  : "Not yet dispatched"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Estimated delivery</dt>
              <dd className="font-medium">
                {order.estimated_delivery
                  ? new Date(order.estimated_delivery).toLocaleDateString()
                  : "TBD"}
              </dd>
            </div>
          </dl>
        </div>

        <div className={cn(!compact && "panel p-6", compact && "rounded-lg border border-border p-4")}>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Carrier details</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Carrier</dt>
              <dd className="font-medium">{order.carrier ?? "Pivoton Logistics"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Current location</dt>
              <dd className="flex items-center gap-1.5 text-right font-medium">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                {order.carrier_location ?? "Awaiting warehouse scan"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ship to</dt>
              <dd className="text-right font-medium">
                {order.shipping_info.full_name}
                <br />
                <span className="text-muted-foreground">
                  {order.shipping_info.shipping_address}, {order.shipping_info.city}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
