import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { History, Nfc } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckoutModal } from "@/components/shop/CheckoutModal";
import { OrderHistoryPanel } from "@/components/shop/OrderHistoryPanel";
import { OrderTrackingModal } from "@/components/shop/OrderTrackingModal";
import { ProductCatalogGrid } from "@/components/shop/ProductCatalogGrid";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { ShoppingWeatherVideoBackground } from "@/components/shop/weather-video";
import {
  decrementInventoryItem,
  ErpApiError,
  fetchErpInventory,
  placeErpOrder,
} from "@/lib/pivoton-erp";
import { useAuth } from "@/context/AuthContext";
import { useUserBalance } from "@/context/UserBalanceContext";
import { deductForPurchase, refundPurchase } from "@/services/user-balances";
import { createSupabaseOrder } from "@/services/supabase-orders";
import { buildOrderLineItem, listShopOrders, saveLocalOrder } from "@/services/shop-orders";
import type {
  ErpInventoryItem,
  ErpInventoryResult,
  PaymentMethod,
  ShippingInfo,
  ShopOrder,
} from "@/types/erp";

type ShopTab = "shopping" | "order-history" | "pos";

type ShopSearch = {
  tab: ShopTab;
  sku?: string;
};

export const Route = createFileRoute("/shop")({
  beforeLoad: ({ search }) => {
    if (search.tab === "gateways") {
      throw redirect({
        to: "/marketplace",
        search: {
          tab: "gateways",
          ...(search.oauth === "success" ? { oauth: "success" as const } : {}),
          ...(typeof search.gateway === "string" ? { gateway: search.gateway } : {}),
        },
      });
    }
  },
  validateSearch: (search: Record<string, unknown>): ShopSearch => {
    const tab = search.tab;
    const sku = typeof search.sku === "string" ? search.sku : undefined;

    if (tab === "order-history" || tab === "history") {
      return { tab: "order-history", sku };
    }
    if (tab === "pos") return { tab: "pos", sku };
    return { tab: "shopping", sku };
  },
  head: () => ({
    meta: [
      { title: "Affiliation Marketplace — Pivoton Gateways & Partner Spending" },
      {
        name: "description",
        content:
          "Trade through affiliated certified brokerage gateways and spend inside Pivoton across ecommerce, delivery, edtech, auto and real estate partners — plus POS and NFC payments.",
      },
      { property: "og:title", content: "Pivoton Affiliation Marketplace" },
      {
        property: "og:description",
        content:
          "Aggregated brokerage gateways, partner shopping with provider tags, and POS/NFC spending.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, openAuthModal } = useAuth();
  const { balance, refreshBalance } = useUserBalance();
  const { tab, sku } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<ShopTab>(tab);
  const [checkoutProduct, setCheckoutProduct] = useState<ErpInventoryItem | null>(null);
  const [detailProduct, setDetailProduct] = useState<ErpInventoryItem | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<ShopOrder | null>(null);
  const openedSkuRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  const inventoryQuery = useQuery({
    queryKey: ["erp-inventory"],
    queryFn: fetchErpInventory,
    enabled: activeTab === "shopping",
    staleTime: 30_000,
    refetchInterval: activeTab === "shopping" ? 60_000 : false,
    retry: false,
  });

  useEffect(() => {
    if (!sku || activeTab !== "shopping") return;
    if (openedSkuRef.current === sku) return;

    const items = inventoryQuery.data?.items ?? [];
    if (items.length === 0) return;

    const normalized = sku.toLowerCase();
    const match = items.find(
      (item) =>
        item.pivoton_sku.toLowerCase() === normalized ||
        item.pivoton_sku.toLowerCase().endsWith(`-${normalized}`) ||
        item.pivoton_sku.toLowerCase().includes(normalized),
    );

    if (match) {
      openedSkuRef.current = sku;
      setDetailProduct(match);
    }
  }, [activeTab, inventoryQuery.data?.items, sku]);

  const ordersQuery = useQuery({
    queryKey: ["shop-orders", user?.id],
    queryFn: () => listShopOrders(user?.id),
    enabled: activeTab === "order-history" && Boolean(user?.id),
    refetchInterval: activeTab === "order-history" ? 15_000 : false,
  });

  const handleConfirmCheckout = useCallback(
    async (input: {
      shipping_info: ShippingInfo;
      payment_method: PaymentMethod;
      total_amount: number;
    }) => {
      if (!checkoutProduct) return;

      if (!user) {
        openAuthModal("Sign in to complete your purchase");
        throw new Error("Authentication required");
      }

      const usesBalance =
        input.payment_method === "credit" || input.payment_method === "pivoton_balance";

      if (usesBalance) {
        const available = balance?.available_balance ?? 0;
        if (available < input.total_amount) {
          toast.error("Insufficient available balance", {
            description: `You have ${available.toFixed(2)} available on your credit line.`,
          });
          throw new Error("Insufficient balance");
        }
      }

      const lineItem = buildOrderLineItem(checkoutProduct);
      let balanceDeducted = false;

      try {
        if (usesBalance) {
          await deductForPurchase(user.id, input.total_amount);
          balanceDeducted = true;
          await refreshBalance();
        }

        const response = await placeErpOrder({
          pivoton_sku: checkoutProduct.pivoton_sku,
          quantity: 1,
          total_price: input.total_amount,
          shipping_info: input.shipping_info,
          payment_method: input.payment_method,
        });

        saveLocalOrder({
          response,
          items: [lineItem],
          shipping_info: input.shipping_info,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
        });

        await createSupabaseOrder({
          user_id: user.id,
          erp_order_id: response.order_id,
          pivoton_sku: checkoutProduct.pivoton_sku,
          product_name: checkoutProduct.title,
          product_image: checkoutProduct.image_url,
          total_price: input.total_amount,
          payment_method: input.payment_method === "credit" ? "Credit line" : input.payment_method,
          status: response.status ?? "PROCESSING",
          tracking_number: response.tracking_number,
          shipping_info: input.shipping_info,
        });

        queryClient.setQueryData<ErpInventoryResult>(["erp-inventory"], (current) => {
          if (!current) return current;
          return {
            ...current,
            items: decrementInventoryItem(current.items, checkoutProduct.pivoton_sku),
          };
        });

        await queryClient.invalidateQueries({ queryKey: ["shop-orders", user.id] });

        if (response.fromFallback) {
          toast.success(`Order #${response.order_id} placed`, {
            description: "Tracking locally while Affiliate ERP sync completes.",
          });
        } else {
          toast.success(`Order #${response.order_id} placed successfully!`);
        }
        setCheckoutProduct(null);
        setActiveTab("order-history");
        navigate({ to: "/shop", search: { tab: "order-history" }, replace: true });
      } catch (error) {
        if (balanceDeducted) {
          await refundPurchase(user.id, input.total_amount);
          await refreshBalance();
        }
        const message =
          error instanceof ErpApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Could not place order. Check your connection and try again.";
        toast.error(
          message.includes("NetworkError")
            ? "Could not reach order service. Please try again."
            : message,
        );
        throw error;
      }
    },
    [
      balance?.available_balance,
      checkoutProduct,
      navigate,
      openAuthModal,
      queryClient,
      refreshBalance,
      user,
    ],
  );

  return (
    <>
      <ShoppingWeatherVideoBackground enabled={activeTab === "shopping"} />

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-16">
        <h1 className="text-4xl font-semibold sm:text-5xl">Affiliation marketplace</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Pivoton is not an exchange. We aggregate certified brokerage gateways and partner
          merchants so your capital, your spending and your loan all live in one place.
        </p>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const nextTab = value as ShopTab;
            setActiveTab(nextTab);
            navigate({ to: "/shop", search: { tab: nextTab }, replace: true });
          }}
          className="mt-12"
        >
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="order-history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Order history
            </TabsTrigger>
            <TabsTrigger value="pos">POS & NFC</TabsTrigger>
          </TabsList>

          <TabsContent value="shopping">
            <ProductCatalogGrid
              items={inventoryQuery.data?.items ?? []}
              loading={inventoryQuery.isLoading}
              onViewProduct={setDetailProduct}
              onCheckout={setCheckoutProduct}
            />
          </TabsContent>

          <TabsContent value="order-history">
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Live fulfillment status polled from Pivoton Affiliate ERP every 15 seconds.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/shop/history">Full history view</Link>
              </Button>
            </div>
            <OrderHistoryPanel
              orders={ordersQuery.data ?? []}
              loading={ordersQuery.isLoading}
              onTrackOrder={setTrackingOrder}
            />
          </TabsContent>

          <TabsContent value="pos" className="mt-8">
            <div className="panel max-w-3xl p-8">
              <Nfc className="h-6 w-6 text-primary" />
              <h2 className="mt-5 text-xl font-semibold">Spend your Pivoton loan offline</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Tap-to-pay at any NFC terminal or swipe at POS using your Pivoton virtual card.
                Every offline transaction is categorised in your loan management view so you always
                know how much of your credit line is spent versus invested.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                <li>· Interchange share on each merchant settlement</li>
                <li>· Partner rebates on categorised spending</li>
                <li>· Optional instalment conversion fee at checkout</li>
              </ul>
              <Button className="mt-8" onClick={() => toast("Virtual card issuance coming soon")}>
                Request virtual card
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <ProductDetailModal
          product={detailProduct}
          open={Boolean(detailProduct)}
          onOpenChange={(open) => {
            if (!open) {
              setDetailProduct(null);
              if (sku) {
                void navigate({ to: "/shop", search: { tab: "shopping" }, replace: true });
              }
            }
          }}
          onCheckout={setCheckoutProduct}
        />

        <CheckoutModal
          product={checkoutProduct}
          open={Boolean(checkoutProduct)}
          onOpenChange={(open) => !open && setCheckoutProduct(null)}
          onConfirm={handleConfirmCheckout}
          availableBalance={balance?.available_balance}
        />

        <OrderTrackingModal
          order={trackingOrder}
          open={Boolean(trackingOrder)}
          onOpenChange={(open) => !open && setTrackingOrder(null)}
        />
      </div>
    </>
  );
}
