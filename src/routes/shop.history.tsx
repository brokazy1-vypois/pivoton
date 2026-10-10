import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderHistoryPanel } from "@/components/shop/OrderHistoryPanel";
import { OrderTrackingModal } from "@/components/shop/OrderTrackingModal";
import { useAuth } from "@/context/AuthContext";
import { listShopOrders } from "@/services/shop-orders";
import type { ShopOrder } from "@/types/erp";

export const Route = createFileRoute("/shop/history")({
  head: () => ({
    meta: [{ title: "Order History — Pivoton Shopping" }],
  }),
  component: ShopHistoryPage,
});

function ShopHistoryPage() {
  const { user } = useAuth();
  const [trackingOrder, setTrackingOrder] = useState<ShopOrder | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["shop-orders", user?.id],
    queryFn: () => listShopOrders(user?.id),
    enabled: Boolean(user?.id),
    refetchInterval: 15_000,
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link to="/shop" search={{ tab: "order-history" }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to marketplace
        </Link>
      </Button>

      <h1 className="text-4xl font-semibold sm:text-5xl">Order history</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">
        Every Pivoton marketplace purchase with item details, cashback earned, and live fulfillment
        status synced from Pivoton Affiliate ERP.
      </p>

      <OrderHistoryPanel
        orders={ordersQuery.data ?? []}
        loading={ordersQuery.isLoading}
        onTrackOrder={setTrackingOrder}
      />

      <OrderTrackingModal
        order={trackingOrder}
        open={Boolean(trackingOrder)}
        onOpenChange={(open) => !open && setTrackingOrder(null)}
      />
    </div>
  );
}
