import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrokerKyc } from "@/context/BrokerKycContext";
import { getBrokerKey, type SignalRecommendation } from "@/types/signal-feed";
import { normalizeTicker } from "@/lib/mock-market-prices";
import { analyzeSignalRecommendation } from "@/lib/signal-ai-analysis";

interface SignalPostCreatorProps {
  roomId: string;
  onPost: (rec: SignalRecommendation) => void;
  onAnalysisComplete: (id: string, rec: Partial<SignalRecommendation>) => void;
}

function parsePrice(value: string): number | null {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SignalPostCreator({ roomId, onPost, onAnalysisComplete }: SignalPostCreatorProps) {
  const { profile, canPostRecommendations } = useBrokerKyc();
  const [ticker, setTicker] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const validation = useMemo(() => {
    const normalized = normalizeTicker(ticker);
    const purchase = parsePrice(purchasePrice);
    const stop = parsePrice(stopLoss);
    const target = parsePrice(targetProfit);

    if (!normalized || normalized.length > 5) {
      return { valid: false, message: "Enter a valid ticker (e.g. TSLA)" };
    }
    if (!purchase) return { valid: false, message: "Enter a valid target purchase price" };
    if (!stop) return { valid: false, message: "Enter a valid stop loss price" };
    if (!target) return { valid: false, message: "Enter a valid target profit price" };
    if (stop >= purchase) {
      return { valid: false, message: "Stop loss must be below target purchase price" };
    }
    if (target <= purchase) {
      return { valid: false, message: "Target profit must be above target purchase price" };
    }
    return { valid: true, message: "" };
  }, [ticker, purchasePrice, stopLoss, targetProfit]);

  if (!canPostRecommendations) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          Only verified brokers with approved license documents can post recommendations. Please
          complete KYC under Broker Profile.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || isPublishing) return;

    const normalized = normalizeTicker(ticker);
    const purchase = parsePrice(purchasePrice)!;
    const stop = parsePrice(stopLoss)!;
    const target = parsePrice(targetProfit)!;
    const id = `sig-${Date.now()}`;
    const brokerKey = profile.brokerKey || getBrokerKey(profile.displayName);

    const rec: SignalRecommendation = {
      id,
      roomId,
      brokerKey,
      brokerName: profile.displayName || "Verified Broker",
      brokerTitle: profile.jobTitle || "Registered Representative",
      brokerLicense: profile.license.split("(").pop()?.replace(")", "").trim() || "Licensed",
      ticker: normalized,
      purchasePrice: purchase,
      stopLoss: stop,
      targetProfit: target,
      status: "IN_PROGRESS",
      createdAt: new Date().toISOString(),
      aiAnalysisStatus: "pending",
      aiAnalysis: null,
    };

    setIsPublishing(true);
    onPost(rec);

    try {
      const aiAnalysis = await analyzeSignalRecommendation({
        ticker: normalized,
        purchasePrice: purchase,
        stopLoss: stop,
        targetProfit: target,
      });
      onAnalysisComplete(id, { aiAnalysis, aiAnalysisStatus: "ready" });
    } catch {
      onAnalysisComplete(id, { aiAnalysisStatus: "error" });
      toast.error("AI analysis failed — recommendation posted without timeline projection.");
    } finally {
      setIsPublishing(false);
      setTicker("");
      setPurchasePrice("");
      setStopLoss("");
      setTargetProfit("");
      toast.success("Recommendation published — AI analysis attached");
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-lg border border-primary/30 bg-surface-2 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Post new recommendation
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sig-ticker">Stock ticker</Label>
          <Input
            id="sig-ticker"
            placeholder="$TSLA"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-price">Target purchase price (USD)</Label>
          <Input
            id="sig-price"
            type="number"
            step="0.01"
            min="0"
            placeholder="240.00"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-stop">Stop loss price (USD)</Label>
          <Input
            id="sig-stop"
            type="number"
            step="0.01"
            min="0"
            placeholder="225.00"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-target">Target profit price (USD)</Label>
          <Input
            id="sig-target"
            type="number"
            step="0.01"
            min="0"
            placeholder="280.00"
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
          />
        </div>
      </div>

      {!validation.valid && (ticker || purchasePrice || stopLoss || targetProfit) && (
        <p className="text-xs text-destructive">{validation.message}</p>
      )}

      <p className="text-[10px] text-muted-foreground">
        New recommendations always start as <span className="text-gold">IN_PROGRESS (Pending)</span>.
        AI timeline analysis runs automatically on publish.
      </p>

      <Button
        type="submit"
        size="sm"
        className="gap-1.5"
        disabled={!validation.valid || isPublishing}
      >
        {isPublishing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {isPublishing ? "Publishing…" : "Publish signal"}
      </Button>
    </form>
  );
}
