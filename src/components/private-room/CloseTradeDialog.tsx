import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLivePrice } from "@/lib/mock-market-prices";
import type { SignalRecommendation } from "@/types/signal-feed";

interface CloseTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticker: string;
  seed: number;
  onConfirm: (exitPrice: number) => void;
}

export function CloseTradeDialog({
  open,
  onOpenChange,
  ticker,
  seed,
  onConfirm,
}: CloseTradeDialogProps) {
  const livePrice = getLivePrice(ticker, seed);
  const [exitPrice, setExitPrice] = useState(livePrice.toFixed(2));

  const handleOpenChange = (next: boolean) => {
    if (next) setExitPrice(getLivePrice(ticker, seed).toFixed(2));
    onOpenChange(next);
  };

  const handleConfirm = () => {
    const price = parseFloat(exitPrice);
    if (!price || price <= 0) return;
    onConfirm(price);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close trade — ${ticker.replace(/^\$/, "")}</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the final exit price to mark this recommendation as closed and calculate realized
            P&amp;L.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="exit-price">Exit price (USD)</Label>
          <Input
            id="exit-price"
            type="number"
            step="0.01"
            min="0"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExitPrice(getLivePrice(ticker, seed).toFixed(2))}
          >
            Use live market price (${livePrice.toFixed(2)})
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Close trade</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AiAnalysisBlock({
  status,
  analysis,
}: {
  status?: SignalRecommendation["aiAnalysisStatus"];
  analysis?: SignalRecommendation["aiAnalysis"] | null;
}) {
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 p-3 text-gold">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Running AI timeline analysis…</span>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold">
          AI Estimated Purchase Window
        </span>
        <span className="rounded border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] capitalize text-gold">
          Confidence: {analysis.confidence}
        </span>
      </div>
      <p className="mt-2 font-display text-sm font-semibold text-foreground">
        {analysis.purchaseWindow}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {analysis.purchaseWindowDetail}
      </p>
      <div className="mt-3 border-t border-gold/20 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
          Target profit projection
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {analysis.profitProjection}
        </p>
      </div>
    </div>
  );
}
