import { Package, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/pivoton-erp";
import type { ErpOrderStatus, ShopOrder } from "@/types/erp";

function statusBadgeClass(status: ErpOrderStatus): string {
  switch (status) {
    case "PROCESSING":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "SHIPPED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "DELIVERED":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "CANCELLED":
      return "bg-bear/15 text-bear border-bear/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
}

function formatStatus(status: ErpOrderStatus): string {
  return status.replaceAll("_", " ");
}

interface OrderHistoryPanelProps {
  orders: ShopOrder[];
  loading?: boolean;
  onTrackOrder?: (order: ShopOrder) => void;
}

export function OrderHistoryPanel({ orders, loading, onTrackOrder }: OrderHistoryPanelProps) {
  if (loading) {
    return (
      <div className="panel mt-8 p-8 text-center text-sm text-muted-foreground">
        Loading order history…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="panel mt-8 p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          No orders yet. Purchase from the Shopping tab to see history here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {orders.map((order) => {
        const primaryItem = order.items[0];
        return (
          <div
            key={order.order_id}
            className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                {primaryItem?.image_url ? (
                  <img
                    src={primaryItem.image_url}
                    alt={primaryItem.title}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Store className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{order.order_id}</p>
                  <Badge variant="outline" className={statusBadgeClass(order.status)}>
                    {formatStatus(order.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.items.map((item) => item.title).join(", ")} ·{" "}
                  {order.payment_method === "credit"
                    ? "Credit line"
                    : order.payment_method === "pivoton_balance"
                      ? "Pivoton Balance"
                      : order.payment_method}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              <div className="text-left sm:text-right">
                <p className="font-display text-lg font-semibold">
                  {formatUsd(order.total_amount)}
                </p>
                <p className="text-xs text-primary">
                  {formatUsd(order.cashback_received)} cashback
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTrackOrder?.(order)}
              >
                Track package
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
