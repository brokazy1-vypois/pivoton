import { useEffect, useState } from "react";
import { BadgeCheck, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { calcPnLPercent, getLivePrice, normalizeTicker } from "@/lib/mock-market-prices";
import { AiAnalysisBlock, CloseTradeDialog } from "./CloseTradeDialog";
import type { SignalRecommendation } from "@/types/signal-feed";

const STATUS_CONFIG = {
  IN_PROGRESS: {
    label: "Pending",
    className: "border-gold/40 bg-gold/10 text-gold",
  },
  PURCHASED: {
    label: "Active",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  CLOSED: {
    label: "Closed",
    className: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  },
} as const;

interface RecommendationCardProps {
  recommendation: SignalRecommendation;
  isOwner: boolean;
  onCloseTrade: (id: string, exitPrice: number) => void;
}

export function RecommendationCard({
  recommendation,
  isOwner,
  onCloseTrade,
}: RecommendationCardProps) {
  const [livePrice, setLivePrice] = useState(() =>
    getLivePrice(recommendation.ticker, recommendation.id.length),
  );
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const ticker = normalizeTicker(recommendation.ticker);
  const statusCfg = STATUS_CONFIG[recommendation.status];
  const isClosed = recommendation.status === "CLOSED";
  const showLivePnL = recommendation.status === "PURCHASED";
  const exitPrice =
    isClosed && recommendation.closePrice ? recommendation.closePrice : livePrice;
  const pnl = calcPnLPercent(recommendation.purchasePrice, exitPrice);
  const isPositive = pnl >= 0;
  const canClose =
    isOwner && (recommendation.status === "IN_PROGRESS" || recommendation.status === "PURCHASED");

  useEffect(() => {
    if (recommendation.status !== "PURCHASED") return;
    const interval = setInterval(() => {
      setLivePrice(getLivePrice(recommendation.ticker, recommendation.id.length));
    }, 4000);
    return () => clearInterval(interval);
  }, [recommendation.id, recommendation.status, recommendation.ticker]);

  return (
    <>
      <article className="panel overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{recommendation.brokerName}</p>
              <p className="text-[11px] text-muted-foreground">
                {recommendation.brokerTitle} · {recommendation.brokerLicense}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="font-display text-lg font-bold text-gold">${ticker}</span>
            <Badge variant="outline" className={statusCfg.className}>
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          {(recommendation.status === "IN_PROGRESS" || recommendation.aiAnalysis) && (
            <AiAnalysisBlock
              status={recommendation.aiAnalysisStatus}
              analysis={recommendation.aiAnalysis}
            />
          )}

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <PriceCell label="Target purchase" value={recommendation.purchasePrice} />
            <PriceCell label="Stop loss" value={recommendation.stopLoss} />
            <PriceCell label="Target profit" value={recommendation.targetProfit} highlight />
            {showLivePnL && <PriceCell label="Live market" value={livePrice} />}
            {isClosed && recommendation.closePrice != null && (
              <PriceCell label="Exit price" value={recommendation.closePrice} />
            )}
          </div>

          {(showLivePnL || isClosed) && (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5",
                isPositive ? "bg-bull/10" : "bg-bear/10",
              )}
            >
              <span className="text-xs text-muted-foreground">
                {isClosed ? "Realized P&L" : "Unrealized P&L"}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 font-display text-base font-bold",
                  isPositive ? "text-bull" : "text-bear",
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isPositive ? "+" : ""}
                {pnl}% {isPositive ? "Profit" : "Loss"}
              </span>
            </div>
          )}

          {canClose && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-bear/40 text-bear hover:bg-bear/10 hover:text-bear"
              onClick={() => setCloseDialogOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Close trade
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground">
            Posted {new Date(recommendation.createdAt).toLocaleString()}
            {recommendation.closedAt &&
              ` · Closed ${new Date(recommendation.closedAt).toLocaleString()}`}
          </p>
        </div>
      </article>

      <CloseTradeDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        ticker={ticker}
        seed={recommendation.id.length}
        onConfirm={(exitPrice) => onCloseTrade(recommendation.id, exitPrice)}
      />
    </>
  );
}

function PriceCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display font-semibold",
          highlight && "text-gold",
        )}
      >
        ${value.toFixed(2)}
      </p>
    </div>
  );
}
