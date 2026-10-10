import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getTradingGateway } from "@/data/trading-gateways";
import { formatUsd } from "@/lib/pivoton-erp";

interface GatewayDisconnectModalProps {
  gatewayId: string | null;
  open: boolean;
  disconnecting: boolean;
  reservedAmount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (gatewayId: string) => void | Promise<void>;
}

export function GatewayDisconnectModal({
  gatewayId,
  open,
  disconnecting,
  reservedAmount,
  onOpenChange,
  onConfirm,
}: GatewayDisconnectModalProps) {
  const gateway = gatewayId ? getTradingGateway(gatewayId) : null;
  const gatewayName = gateway?.name ?? "this gateway";
  const hasActiveReserves = reservedAmount > 0;

  const handleClose = (next: boolean) => {
    if (disconnecting) return;
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!gatewayId || disconnecting) return;
    void onConfirm(gatewayId);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {hasActiveReserves
              ? "Disconnect Gateway & Refund Active Reserves?"
              : "Disconnect Gateway?"}
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {hasActiveReserves ? (
              <>
                Disconnecting {gatewayName} will automatically cancel active reserves allocated to
                this gateway. A total of {formatUsd(reservedAmount)} will be unfrozen and returned
                directly to your Available Balance.
              </>
            ) : (
              <>
                Disconnecting {gatewayName} will revoke Pivoton&apos;s access to route orders and
                fetch account balances through this brokerage. Any active allocation preferences
                using this gateway will be reset.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasActiveReserves && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Reserved funds tied to this gateway will be released immediately. Your marketplace
              reserves will no longer route through {gatewayName}.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={disconnecting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!gatewayId || disconnecting}
            onClick={handleConfirm}
          >
            {disconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {hasActiveReserves ? "Releasing funds…" : "Disconnecting…"}
              </>
            ) : hasActiveReserves ? (
              "Confirm & Release Funds"
            ) : (
              "Confirm Disconnect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
