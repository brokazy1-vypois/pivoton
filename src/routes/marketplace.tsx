import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EyeOff, ShieldCheck, Wallet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeepAnalysisModal } from "@/components/marketplace/DeepAnalysisModal";
import { GatewayRequiredModal } from "@/components/marketplace/GatewayRequiredModal";
import { ReserveFundsModal } from "@/components/marketplace/ReserveFundsModal";
import { TradingGatewaysPanel } from "@/components/gateways/TradingGatewaysPanel";
import { useAuth } from "@/context/AuthContext";
import { useTradingGateways } from "@/context/TradingGatewayContext";
import { useUserBalance } from "@/context/UserBalanceContext";
import { MARKETPLACE_RUMORS } from "@/data/marketplace-rumors";
import { formatUsd } from "@/lib/pivoton-erp";
import { formatAnonymizedReserveLabel } from "@/lib/anonymized-opportunity";
import { addInvestmentHolding } from "@/services/investment-holdings";
import {
  executeMarketplaceReserve,
  verifyAlpacaForReserve,
} from "@/services/alpaca-gateway";
import { getPrimaryAlpacaOAuthToken } from "@/services/alpaca-oauth-tokens";
import { reserveForInvestment } from "@/services/user-balances";
import type { MarketplaceRumor } from "@/types/market-analysis";
import type { GatewayAllocation } from "@/types/trading-gateway";

type MarketplaceTab = "deals" | "gateways";

type MarketplaceSearch = {
  tab: MarketplaceTab;
  oauth?: "success";
  gateway?: string;
};

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search: Record<string, unknown>): MarketplaceSearch => {
    const tab = search.tab === "gateways" ? "gateways" : "deals";
    const oauth = search.oauth === "success" ? "success" : undefined;
    const gateway = typeof search.gateway === "string" ? search.gateway : undefined;
    return { tab, oauth, gateway };
  },
  head: () => ({
    meta: [
      { title: "Safe Investment Marketplace — Pivoton Guaranteed Trades" },
      {
        name: "description",
        content:
          "AI-verified rumors from certified brokerage firms published one trading day early. Deposit into guaranteed ETF and stock allocations with a loss-only insurance fee capped at 3%.",
      },
      { property: "og:title", content: "Pivoton Safe Investment Marketplace" },
      {
        property: "og:description",
        content: "Hidden-ticker rumors, guaranteed allocations and a 3% maximum loss-case insurance fee.",
      },
    ],
  }),
  component: Marketplace,
});

function Marketplace() {
  const navigate = useNavigate();
  const { tab, oauth, gateway } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>(tab);
  const { user, openAuthModal } = useAuth();
  const { connectedGatewayIds, userConnectedGateways } = useTradingGateways();
  const { balance, refreshBalance } = useUserBalance();
  const queryClient = useQueryClient();
  const [selectedRumor, setSelectedRumor] = useState<MarketplaceRumor | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [reserveRumor, setReserveRumor] = useState<MarketplaceRumor | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [gatewayRequiredOpen, setGatewayRequiredOpen] = useState(false);

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  const openAnalysis = (rumor: MarketplaceRumor) => {
    setSelectedRumor(rumor);
    setAnalysisOpen(true);
  };

  const handleFundAndReserve = useCallback(
    (rumor: MarketplaceRumor) => {
      if (!user) {
        openAuthModal("Sign in to fund and reserve this opportunity");
        return;
      }

      if (userConnectedGateways.length === 0) {
        setGatewayRequiredOpen(true);
        return;
      }

      setReserveRumor(rumor);
      setReserveOpen(true);
    },
    [openAuthModal, user, userConnectedGateways.length],
  );

  const handleConfirmReserve = useCallback(
    async (input: { totalAmount: number; allocations: GatewayAllocation[] }) => {
      if (!user || !reserveRumor) return;

      const oauthToken = getPrimaryAlpacaOAuthToken(user.id, connectedGatewayIds);

      await verifyAlpacaForReserve(oauthToken?.accessToken);
      const execution = await executeMarketplaceReserve({
        rumorId: reserveRumor.id,
        allocations: input.allocations,
        timeInForce: "day",
        oauthAccessToken: oauthToken?.accessToken,
      });

      await reserveForInvestment(user.id, input.totalAmount);
      await addInvestmentHolding(user.id, {
        id: crypto.randomUUID(),
        rumorId: reserveRumor.id,
        rumorSector: reserveRumor.sector,
        totalAmount: input.totalAmount,
        allocations: input.allocations,
        status: "locked",
        createdAt: new Date().toISOString(),
        alpacaOrderIds: execution.orderIds,
        routedVenues: execution.routedVenues,
      });
      await refreshBalance();
      await queryClient.invalidateQueries({ queryKey: ["investment-holdings", user.id] });

      toast.success("Funds reserved and locked", {
        description: `${formatUsd(input.totalAmount)} reserved for ${formatAnonymizedReserveLabel(reserveRumor)} · routed via ${execution.routedVenues.slice(0, 3).join(", ")}${execution.routedVenues.length > 3 ? "…" : ""}.`,
      });
    },
    [connectedGatewayIds, queryClient, refreshBalance, reserveRumor, user],
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <Badge variant="outline" className="border-primary/40 text-primary">
        T-1 rumor desk
      </Badge>
      <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">Safe investment marketplace</h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
        Pivoton's AI filters and verifies recommendations heated across other brokerage firms and
        publishes them one trading day early, so you have time to fund your wallet. Ticker names stay
        hidden — you see the trade graph and index exposure until the position opens.
      </p>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as MarketplaceTab;
          setActiveTab(nextTab);
          navigate({ to: "/marketplace", search: { tab: nextTab }, replace: true });
        }}
        className="mt-10"
      >
        <TabsList className="inline-flex h-auto rounded-full border border-slate-800 bg-[#0F172A] p-1">
          <TabsTrigger
            value="deals"
            className="rounded-full px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200 data-[state=active]:bg-[#1E293B] data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Guaranteed Deals
          </TabsTrigger>
          <TabsTrigger
            value="gateways"
            className="rounded-full px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200 data-[state=active]:bg-[#1E293B] data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            Trading Gateways
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="mt-8">
      <div className="panel flex gap-4 p-6">
        <AlertTriangle className="h-5 w-5 shrink-0 text-gold" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Insurance fee terms.</span> Guaranteed
          positions are covered by Pivoton. If a covered trade closes at a loss, an insurance fee of
          up to <span className="font-medium text-foreground">3% of the covered amount</span> is
          charged — the 3% is a maximum, never exceeded. If the trade closes in profit, you pay
          nothing: no insurance fee, no commission, no success fee.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {MARKETPLACE_RUMORS.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => openAnalysis(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openAnalysis(r);
              }
            }}
            className="panel flex cursor-pointer flex-col p-7 text-left transition-colors hover:border-primary/40 hover:bg-surface-2/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openAnalysis(r);
                }}
              >
                <EyeOff className="h-3 w-3" /> Ticker hidden
              </Badge>
            </div>

            <h2 className="mt-5 text-lg font-semibold">{r.sector}</h2>
            <p className="text-xs text-muted-foreground">
              {r.index} · verified across {r.firms} firms
            </p>

            <Sparkline points={r.trend} />

            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI conviction</span>
                <span className="text-foreground">{r.conviction}%</span>
              </div>
              <Progress value={r.conviction} />
            </div>

            <dl className="mt-6 space-y-2 border-t border-border pt-5 text-xs">
              <Row label="Deposit cap" value={r.cap} />
              <Row label="Guarantee" value="Covered · max 3% loss fee" />
              <Row label="Window" value={r.window} />
            </dl>

            <div className="mt-6 flex gap-2">
              <Button
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFundAndReserve(r);
                }}
              >
                <Wallet className="mr-1.5 h-4 w-4" /> Fund & reserve
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-10 flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        Deposits sit in your Pivoton wallet until the position opens. Unfilled reservations are
        released back in full.
      </div>
        </TabsContent>

        <TabsContent value="gateways" className="mt-8">
          <TradingGatewaysPanel oauthStatus={oauth} oauthGatewayId={gateway} />
        </TabsContent>
      </Tabs>

      <DeepAnalysisModal
        rumor={selectedRumor}
        open={analysisOpen}
        onOpenChange={(open) => {
          setAnalysisOpen(open);
          if (!open) setSelectedRumor(null);
        }}
      />

      <GatewayRequiredModal open={gatewayRequiredOpen} onOpenChange={setGatewayRequiredOpen} />

      <ReserveFundsModal
        rumor={reserveRumor}
        open={reserveOpen}
        onOpenChange={(open) => {
          setReserveOpen(open);
          if (!open) setReserveRumor(null);
        }}
        connectedGatewayIds={connectedGatewayIds}
        availableBalance={balance?.available_balance ?? 0}
        onConfirm={handleConfirmReserve}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 40 - ((p - min) / (max - min || 1)) * 34;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const rising = points[points.length - 1]! >= points[0]!;

  return (
    <svg viewBox="0 0 100 44" className="mt-6 h-20 w-full" preserveAspectRatio="none">
      <path
        d={path}
        fill="none"
        stroke={rising ? "var(--bull)" : "var(--bear)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
