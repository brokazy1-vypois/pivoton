import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderTrackingView } from "@/components/shop/OrderTrackingView";
import { syncOrderTracking } from "@/services/shop-orders";
import type { ShopOrder } from "@/types/erp";

interface OrderTrackingModalProps {
  order: ShopOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderTrackingModal({ order, open, onOpenChange }: OrderTrackingModalProps) {
  const trackingQuery = useQuery({
    queryKey: ["shop-order-tracking", order?.order_id],
    queryFn: () => syncOrderTracking(order!.order_id),
    enabled: open && Boolean(order?.order_id),
    refetchInterval: open ? 10_000 : false,
  });

  const liveOrder = trackingQuery.data ?? order;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-[#121824] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Package tracking</DialogTitle>
          <DialogDescription>
            Live fulfillment status synced from Pivoton Affiliate ERP.
          </DialogDescription>
        </DialogHeader>
        {liveOrder && (
          <OrderTrackingView order={liveOrder} syncing={trackingQuery.isFetching} compact />
        )}
      </DialogContent>
    </Dialog>
  );
}
