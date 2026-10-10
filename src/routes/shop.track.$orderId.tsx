import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderTrackingView } from "@/components/shop/OrderTrackingView";
import { getLocalOrder, syncOrderTracking } from "@/services/shop-orders";

export const Route = createFileRoute("/shop/track/$orderId")({
  head: ({ params }) => ({
    meta: [{ title: `Track Order ${params.orderId} — Pivoton Shopping` }],
  }),
  component: ShopTrackPage,
});

function ShopTrackPage() {
  const { orderId } = Route.useParams();

  const trackingQuery = useQuery({
    queryKey: ["shop-order-tracking", orderId],
    queryFn: async () => {
      const synced = await syncOrderTracking(orderId);
      return synced ?? getLocalOrder(orderId) ?? null;
    },
    refetchInterval: 10_000,
  });

  const order = trackingQuery.data;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link to="/shop" search={{ tab: "order-history" }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Order history
        </Link>
      </Button>

      {trackingQuery.isLoading && !order && (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading tracking details…
        </div>
      )}

      {!trackingQuery.isLoading && !order && (
        <div className="panel p-8 text-center">
          <p className="text-lg font-medium">Order not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t locate order <span className="font-mono">{orderId}</span>.
          </p>
          <Button asChild className="mt-6">
            <Link to="/shop" search={{ tab: "shopping" }}>
              Browse marketplace
            </Link>
          </Button>
        </div>
      )}

      {order && <OrderTrackingView order={order} syncing={trackingQuery.isFetching} />}
    </div>
  );
}
