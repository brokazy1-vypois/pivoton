import { useState } from "react";
import { ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { getLinkedBankAccount, processWalletWithdrawal } from "@/services/wallet-banking";
import { formatUsd } from "@/lib/pivoton-erp";

interface WalletWithdrawModalProps {
  open: boolean;
  userId: string;
  availableBalance: number;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void | Promise<void>;
}

export function WalletWithdrawModal({
  open,
  userId,
  availableBalance,
  onOpenChange,
  onComplete,
}: WalletWithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const linked = getLinkedBankAccount(userId);
  const numericAmount = Number.parseFloat(amount) || 0;

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) setAmount("");
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await processWalletWithdrawal({ userId, amount: numericAmount });
      toast.success(`Withdrawal of ${formatUsd(numericAmount)} sent to ${result.bankName}.`);
      setAmount("");
      await onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Withdrawal failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Withdraw Cash</DialogTitle>
          <DialogDescription>
            ACH payout to your linked US bank. Reserved Guaranteed Deal funds cannot be withdrawn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/60 bg-surface-2/20 p-4 text-sm">
            <p className="text-muted-foreground">Linked account</p>
            <p className="mt-1 font-medium">
              {linked ? `${linked.bankName} ·••• ${linked.mask}` : "No bank linked — deposit first to link Plaid sandbox"}
            </p>
            <p className="mt-3 text-muted-foreground">Available to withdraw</p>
            <p className="mt-1 font-display text-xl font-semibold text-[#00E599]">
              {formatUsd(availableBalance)}
            </p>
          </div>

          <div>
            <Label htmlFor="withdraw-amount">Withdrawal amount (USD)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={availableBalance}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting || !linked || numericAmount <= 0 || numericAmount > availableBalance}
            onClick={() => void handleConfirm()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <ArrowUpFromLine className="mr-2 h-4 w-4" /> Confirm Withdrawal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
