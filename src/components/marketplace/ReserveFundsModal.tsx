import { useEffect, useMemo, useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/pivoton-erp";
import { toAnonymizedOpportunity } from "@/lib/anonymized-opportunity";
import { getTradingGateway } from "@/data/trading-gateways";
import type { GatewayAllocation, TradingGateway } from "@/types/trading-gateway";
import type { MarketplaceRumor } from "@/types/market-analysis";

interface ReserveFundsModalProps {
  rumor: MarketplaceRumor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedGatewayIds: string[];
  availableBalance: number;
  onConfirm: (input: {
    totalAmount: number;
    allocations: GatewayAllocation[];
  }) => Promise<void>;
}

function parseDepositCap(cap: string): number {
  return Number(cap.replace(/[^0-9.]/g, "")) || 0;
}

export function ReserveFundsModal({
  rumor,
  open,
  onOpenChange,
  connectedGatewayIds,
  availableBalance,
  onConfirm,
}: ReserveFundsModalProps) {
  const connectedGateways = useMemo(
    () =>
      connectedGatewayIds
        .map((id) => getTradingGateway(id))
        .filter((gateway): gateway is TradingGateway => Boolean(gateway)),
    [connectedGatewayIds],
  );

  const [amount, setAmount] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [primaryGatewayId, setPrimaryGatewayId] = useState("");
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositCap = rumor ? parseDepositCap(rumor.cap) : 0;
  const numericAmount = Number(amount) || 0;
  const multipleGateways = connectedGateways.length > 1;
  const anonymized = rumor ? toAnonymizedOpportunity(rumor) : null;

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setSplitEnabled(false);
    setPrimaryGatewayId(connectedGatewayIds[0] ?? "");
    setSplitAmounts(Object.fromEntries(connectedGatewayIds.map((id) => [id, ""])));
    setSubmitting(false);
    setError(null);
  }, [open, rumor?.id, connectedGatewayIds]);

  const splitTotal = useMemo(
    () =>
      connectedGateways.reduce((sum, gateway) => {
        return sum + (Number(splitAmounts[gateway.id]) || 0);
      }, 0),
    [connectedGateways, splitAmounts],
  );

  const buildAllocations = (): GatewayAllocation[] => {
    if (!splitEnabled) {
      const gateway = connectedGateways.find((item) => item.id === primaryGatewayId);
      if (!gateway) return [];
      return [{ gatewayId: gateway.id, gatewayName: gateway.name, amount: numericAmount }];
    }

    return connectedGateways
      .map((gateway) => ({
        gatewayId: gateway.id,
        gatewayName: gateway.name,
        amount: Number(splitAmounts[gateway.id]) || 0,
      }))
      .filter((allocation) => allocation.amount > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numericAmount <= 0) {
      setError("Enter a deposit amount greater than zero.");
      return;
    }

    if (depositCap > 0 && numericAmount > depositCap) {
      setError(`Deposit exceeds the cap of ${formatUsd(depositCap)} for this opportunity.`);
      return;
    }

    if (numericAmount > availableBalance) {
      setError(`Insufficient available balance. You have ${formatUsd(availableBalance)} available.`);
      return;
    }

    if (splitEnabled) {
      if (Math.abs(splitTotal - numericAmount) > 0.009) {
        setError(
          `Split amounts must equal the total deposit (${formatUsd(numericAmount)}). Current split: ${formatUsd(splitTotal)}.`,
        );
        return;
      }
    } else if (!primaryGatewayId) {
      setError("Select a gateway to route this deposit.");
      return;
    }

    const allocations = buildAllocations();
    if (allocations.length === 0) {
      setError("Assign at least one gateway allocation.");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({ totalAmount: numericAmount, allocations });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reserve funds.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-lg transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="font-display">Reserve funds</DialogTitle>
          <DialogDescription>
            Deposit USD into an anonymized opportunity. Underlying ticker codes remain hidden until
            the position opens.
          </DialogDescription>
        </DialogHeader>

        {anonymized && (
          <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{anonymized.refCode}</span>
              <Badge variant="secondary" className="gap-1">
                <EyeOff className="h-3 w-3" />
                Ticker hidden
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">{anonymized.sector}</p>
            <p className="mt-1 text-xs text-muted-foreground">{anonymized.index}</p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reserve-amount">Deposit amount (USD)</Label>
            <Input
              id="reserve-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="2500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Available: {formatUsd(availableBalance)}
              {depositCap > 0 ? ` · Cap: ${formatUsd(depositCap)}` : ""}
            </p>
          </div>

          {connectedGateways.length === 1 && connectedGateways[0] && (
            <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4 text-sm">
              <p className="text-muted-foreground">Routing through</p>
              <p className="mt-1 font-medium text-[#00E599]">{connectedGateways[0].name}</p>
            </div>
          )}

          {multipleGateways && (
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Split allocation across gateways</p>
                  <p className="text-xs text-muted-foreground">
                    Assign custom dollar amounts per connected gateway for this single order.
                  </p>
                </div>
                <Switch checked={splitEnabled} onCheckedChange={setSplitEnabled} />
              </div>

              {!splitEnabled ? (
                <RadioGroup value={primaryGatewayId} onValueChange={setPrimaryGatewayId}>
                  {connectedGateways.map((gateway) => (
                    <label
                      key={gateway.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 px-3 py-2"
                    >
                      <RadioGroupItem value={gateway.id} />
                      <span className="text-sm">{gateway.name}</span>
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {connectedGateways.map((gateway) => (
                    <div key={gateway.id} className="space-y-1.5">
                      <Label htmlFor={`split-${gateway.id}`}>{gateway.name}</Label>
                      <Input
                        id={`split-${gateway.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={splitAmounts[gateway.id] ?? ""}
                        onChange={(e) =>
                          setSplitAmounts((current) => ({
                            ...current,
                            [gateway.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Split total: {formatUsd(splitTotal)} / {formatUsd(numericAmount || 0)}
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm reserve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
