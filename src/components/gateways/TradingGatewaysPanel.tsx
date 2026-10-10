import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlpacaConnectModal } from "@/components/gateways/AlpacaConnectModal";
import { GatewayDisconnectModal } from "@/components/gateways/GatewayDisconnectModal";
import { useAuth } from "@/context/AuthContext";
import { useUserBalance } from "@/context/UserBalanceContext";
import { useTradingGateways } from "@/context/TradingGatewayContext";
import { resolveExchangeRouteLabels } from "@/data/alpaca-exchanges";
import {
  GATEWAY_CATEGORY_LABELS,
  GATEWAY_CATEGORY_ORDER,
  TRADING_GATEWAYS,
  TRADING_GATEWAY_COUNT,
  UNIFIED_GATEWAY_HEADLINE,
  groupGatewaysByCategory,
} from "@/data/trading-gateways";
import {
  getAlpacaOAuthAuthorizeUrl,
  getGatewayConnectSuccessMessage,
  isAlpacaOAuthClientConfigured,
  simulateDevGatewayVerification,
  verifyAlpacaGateway,
  formatGatewayConnectError,
  shouldAttemptDevGatewayFallback,
} from "@/services/alpaca-gateway";
import { getAlpacaOAuthToken } from "@/services/alpaca-oauth-tokens";
import { disconnectAlpacaGateway } from "@/services/alpaca-gateway";
import {
  getActiveReserveAmountByGateway,
  releaseGatewayReserveFunds,
} from "@/services/gateway-reserve-release";
import { formatUsd } from "@/lib/pivoton-erp";
import type { GatewayCategory, GatewayConnectionStatus, TradingGateway } from "@/types/trading-gateway";

interface TradingGatewaysPanelProps {
  oauthStatus?: "success";
  oauthGatewayId?: string;
}

/** Expand common search terms to match asset class strings in gateway data. */
function expandSearchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const expanded = new Set(tokens);

  const assetAliases: Record<string, string[]> = {
    equity: ["equities", "us equities", "global equities", "fractional equities"],
    equities: ["equities", "us equities", "global equities", "fractional equities"],
    etf: ["etf", "etfs"],
    etfs: ["etf", "etfs"],
    option: ["options"],
    options: ["options"],
    crypto: ["crypto"],
    futures: ["futures"],
    bonds: ["bonds", "fixed income"],
    "mutual funds": ["mutual funds"],
    us: ["us"],
    eu: ["eu"],
    apac: ["apac"],
    global: ["global", "uk"],
    uk: ["uk", "global"],
    ca: ["ca"],
  };

  for (const token of tokens) {
    for (const alias of assetAliases[token] ?? []) {
      expanded.add(alias);
    }
  }

  return [...expanded];
}

function matchesGateway(gateway: TradingGateway, query: string): boolean {
  const terms = expandSearchTerms(query);
  if (terms.length === 0) return true;

  const haystack = [
    gateway.name,
    GATEWAY_CATEGORY_LABELS[gateway.category],
    ...gateway.assetClasses,
    ...gateway.regions,
    gateway.fee,
    ...resolveExchangeRouteLabels(gateway.exchangeRoutes),
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function StatusBadge({ status }: { status: GatewayConnectionStatus }) {
  if (status === "connected") {
    return (
      <Badge className="border-[#00E599]/40 bg-[#00E599]/10 text-[#00E599] hover:bg-[#00E599]/10">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#00E599]" />
        Connected
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge variant="secondary" className="border-primary/30 text-primary">
        Connecting…
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Not Connected
    </Badge>
  );
}

function GatewayCard({
  gateway,
  status,
  verifying,
  onConnect,
  onDisconnect,
}: {
  gateway: TradingGateway;
  status: GatewayConnectionStatus;
  verifying: boolean;
  onConnect: (gatewayId: string) => void;
  onDisconnect: (gatewayId: string) => void;
}) {
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const routeLabels = resolveExchangeRouteLabels(gateway.exchangeRoutes);

  return (
    <div className="panel flex flex-col gap-4 p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{gateway.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {gateway.regions.join(", ")} · {gateway.assetClasses.join(", ")}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-xs text-[#00E599]">{gateway.fee}</p>

      <div className="rounded-md border border-border/50 bg-surface-2/20 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {gateway.category === "regulated-exchange" ? "Direct routing" : "Smart routing"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {routeLabels.slice(0, 6).join(" · ")}
          {routeLabels.length > 6 ? ` · +${routeLabels.length - 6} venues` : ""}
        </p>
      </div>

      <div className="mt-auto flex justify-end">
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            disabled={verifying}
            className="border-border/60 text-muted-foreground hover:border-rose-500/50 hover:bg-rose-500/5 hover:text-rose-400"
            onClick={() => onDisconnect(gateway.id)}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isConnecting || verifying}
            onClick={() => onConnect(gateway.id)}
          >
            {isConnecting ? "Connecting…" : "Connect"}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TradingGatewaysPanel({ oauthStatus, oauthGatewayId }: TradingGatewaysPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, openAuthModal } = useAuth();
  const { refreshBalance } = useUserBalance();
  const {
    getGatewayStatus,
    beginConnect,
    completeConnect,
    cancelConnect,
    disconnectGateway,
    pendingConnectGatewayId,
    setPendingConnectGatewayId,
  } = useTradingGateways();
  const [searchQuery, setSearchQuery] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pendingDisconnectGatewayId, setPendingDisconnectGatewayId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const oauthEnabled = isAlpacaOAuthClientConfigured();

  const filteredGateways = useMemo(
    () => TRADING_GATEWAYS.filter((gateway) => matchesGateway(gateway, searchQuery)),
    [searchQuery],
  );

  const groupedFiltered = useMemo(
    () => groupGatewaysByCategory(filteredGateways),
    [filteredGateways],
  );

  const isFiltered = searchQuery.trim().length > 0;
  const counterLabel = isFiltered
    ? `${filteredGateways.length} of ${TRADING_GATEWAY_COUNT} matches`
    : UNIFIED_GATEWAY_HEADLINE;

  const finalizeGatewayConnection = (
    gatewayId: string,
    result?: Awaited<ReturnType<typeof verifyAlpacaGateway>>,
  ) => {
    completeConnect(gatewayId);
    setPendingConnectGatewayId(null);
    const gateway = TRADING_GATEWAYS.find((item) => item.id === gatewayId);
    const success = getGatewayConnectSuccessMessage(gateway?.name ?? "Gateway", result ?? {
      verified: true,
      gatewayId,
      accountStatus: "DEV_MODE",
    });
    toast.success(success.title, success.description ? { description: success.description } : undefined);
  };

  useEffect(() => {
    if (oauthStatus !== "success" || !oauthGatewayId || !user) return;

    const token = getAlpacaOAuthToken(user.id, oauthGatewayId);
    const finalize = async () => {
      try {
        const result = await verifyAlpacaGateway(oauthGatewayId, token?.accessToken);
        finalizeGatewayConnection(oauthGatewayId, result);
      } catch (error) {
        if (shouldAttemptDevGatewayFallback(error)) {
          const result = await simulateDevGatewayVerification(oauthGatewayId);
          finalizeGatewayConnection(oauthGatewayId, result);
        } else {
          console.error("[Gateway] OAuth callback verification failed:", error);
        }
      } finally {
        void navigate({ to: "/marketplace", search: { tab: "gateways" }, replace: true });
      }
    };

    void finalize();
  }, [navigate, oauthGatewayId, oauthStatus, user]);

  const handleConnectClick = (gatewayId: string) => {
    if (!user) {
      openAuthModal("Sign in to connect a trading gateway");
      return;
    }

    const status = getGatewayStatus(gatewayId);
    if (status === "connecting") return;

    beginConnect(gatewayId);
  };

  const handleDisconnectClick = (gatewayId: string) => {
    if (!user) {
      openAuthModal("Sign in to manage trading gateways");
      return;
    }

    setPendingDisconnectGatewayId(gatewayId);
  };

  const handleDisconnectConfirm = async (gatewayId: string) => {
    if (!user) return;

    setDisconnecting(true);
    try {
      const { releasedAmount } = await releaseGatewayReserveFunds(user.id, gatewayId);

      const token = getAlpacaOAuthToken(user.id, gatewayId);
      await disconnectAlpacaGateway({
        userId: user.id,
        gatewayId,
        oauthAccessToken: token?.accessToken,
      });
      disconnectGateway(gatewayId);

      await refreshBalance();
      await queryClient.invalidateQueries({ queryKey: ["investment-holdings", user.id] });

      const gateway = TRADING_GATEWAYS.find((item) => item.id === gatewayId);
      const gatewayName = gateway?.name ?? "Gateway";

      if (releasedAmount > 0) {
        toast.success(`${gatewayName} disconnected successfully.`, {
          description: `${formatUsd(releasedAmount)} returned to your Available Balance.`,
        });
      } else {
        toast.success(`${gatewayName} disconnected successfully.`);
      }

      setPendingDisconnectGatewayId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect gateway.");
    } finally {
      setDisconnecting(false);
    }
  };

  const disconnectReservedAmount =
    user && pendingDisconnectGatewayId
      ? getActiveReserveAmountByGateway(user.id, pendingDisconnectGatewayId)
      : 0;

  const handleConnectComplete = async (gatewayId: string) => {
    if (!user) return;

    if (oauthEnabled) {
      setVerifying(true);
      try {
        const { url } = await getAlpacaOAuthAuthorizeUrl(gatewayId, user.id);
        window.location.href = url;
      } catch (error) {
        if (shouldAttemptDevGatewayFallback(error)) {
          try {
            const result = await simulateDevGatewayVerification(gatewayId);
            finalizeGatewayConnection(gatewayId, result);
          } finally {
            setVerifying(false);
          }
          return;
        }
        cancelConnect();
        toast.error(formatGatewayConnectError(error));
        setVerifying(false);
      }
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyAlpacaGateway(gatewayId);
      finalizeGatewayConnection(gatewayId, result);
    } catch (error) {
      if (shouldAttemptDevGatewayFallback(error)) {
        const result = await simulateDevGatewayVerification(gatewayId);
        finalizeGatewayConnection(gatewayId, result);
      } else {
        cancelConnect();
        toast.error(formatGatewayConnectError(error));
      }
    } finally {
      setVerifying(false);
    }
  };

  const renderCategorySection = (category: GatewayCategory) => {
    const gateways = groupedFiltered[category];
    if (!gateways?.length) return null;

    return (
      <section key={category} className="space-y-4">
        {!isFiltered && (
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {GATEWAY_CATEGORY_LABELS[category]}
          </h3>
        )}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {gateways.map((gateway) => (
            <GatewayCard
              key={gateway.id}
              gateway={gateway}
              status={getGatewayStatus(gateway.id)}
              verifying={verifying}
              onConnect={handleConnectClick}
              onDisconnect={handleDisconnectClick}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="mt-4">
      <div className="sticky top-20 z-10 -mx-1 mb-6 rounded-lg border border-border/60 bg-[#0B132B]/95 px-1 py-3 backdrop-blur-sm">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by firm, region, or asset type…"
            className="pl-9"
            aria-label="Search trading gateways"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{counterLabel}</p>
      </div>

      {filteredGateways.length === 0 ? (
        <div className="panel p-8 text-sm text-muted-foreground">
          No gateways match your search. Try firm names like Fidelity or Plaid, regions like US, EU,
          APAC, or Global, or asset types like Equities, ETFs, Options, Crypto, or Futures.
        </div>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] space-y-10 overflow-y-auto pr-1">
          {GATEWAY_CATEGORY_ORDER.map((category) => renderCategorySection(category))}
        </div>
      )}

      <AlpacaConnectModal
        gatewayId={pendingConnectGatewayId}
        open={Boolean(pendingConnectGatewayId)}
        verifying={verifying}
        oauthEnabled={oauthEnabled}
        onOpenChange={(open) => {
          if (verifying) return;
          if (!open) {
            cancelConnect();
            setPendingConnectGatewayId(null);
          }
        }}
        onComplete={handleConnectComplete}
        onCancel={cancelConnect}
      />

      <GatewayDisconnectModal
        gatewayId={pendingDisconnectGatewayId}
        open={Boolean(pendingDisconnectGatewayId)}
        disconnecting={disconnecting}
        reservedAmount={disconnectReservedAmount}
        onOpenChange={(open) => {
          if (disconnecting) return;
          if (!open) setPendingDisconnectGatewayId(null);
        }}
        onConfirm={handleDisconnectConfirm}
      />
    </div>
  );
}
