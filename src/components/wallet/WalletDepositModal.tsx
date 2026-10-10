import { useMemo, useState } from "react";
import { ArrowDownToLine, Building2, Check, Loader2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AchTransferSpeed } from "@/types/wallet";
import {
  calculateDepositNetAmount,
  calculateInstantTransferFee,
  processWalletDeposit,
  US_BANK_OPTIONS,
} from "@/services/wallet-banking";
import { formatUsd } from "@/lib/pivoton-erp";

interface WalletDepositModalProps {
  open: boolean;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void | Promise<void>;
}

type DepositStep = "bank" | "auth" | "amount" | "confirm";

export function WalletDepositModal({
  open,
  userId,
  onOpenChange,
  onComplete,
}: WalletDepositModalProps) {
  const [step, setStep] = useState<DepositStep>("bank");
  const [bankId, setBankId] = useState(US_BANK_OPTIONS[0]?.id ?? "chase");
  const [amount, setAmount] = useState("250");
  const [speed, setSpeed] = useState<AchTransferSpeed>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);

  const selectedBank = US_BANK_OPTIONS.find((bank) => bank.id === bankId);
  const numericAmount = Number.parseFloat(amount) || 0;
  const netAmount = useMemo(
    () => calculateDepositNetAmount(numericAmount, speed),
    [numericAmount, speed],
  );
  const fee = useMemo(
    () => (speed === "instant" ? calculateInstantTransferFee(numericAmount) : 0),
    [numericAmount, speed],
  );

  const reset = () => {
    setStep("bank");
    setAuthComplete(false);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await processWalletDeposit({
        userId,
        bankId,
        amount: numericAmount,
        speed,
      });
      toast.success(`Successfully deposited ${formatUsd(result.netAmount)} from ${result.bankName} via ACH.`);
      await onComplete();
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deposit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Deposit Funds</DialogTitle>
          <DialogDescription>
            Connect a US bank via Plaid sandbox and transfer cash into your Pivoton wallet.
          </DialogDescription>
        </DialogHeader>

        {step === "bank" && (
          <div className="grid gap-3 py-2">
            {US_BANK_OPTIONS.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setBankId(bank.id)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  bankId === bank.id
                    ? "border-[#00E599]/50 bg-[#00E599]/10"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: bank.accent }}
                >
                  {bank.name.slice(0, 1)}
                </span>
                <span className="font-medium">{bank.name}</span>
              </button>
            ))}
          </div>
        )}

        {step === "auth" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 bg-surface-2/30 p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-[#00E599]" />
                <div>
                  <p className="font-medium">{selectedBank?.name}</p>
                  <p className="text-xs text-muted-foreground">Plaid Instant Auth (sandbox simulation)</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <Input placeholder="Online banking username" defaultValue="user_good" />
                <Input type="password" placeholder="Password" defaultValue="••••••••" />
              </div>
            </div>
            <Button
              type="button"
              className="w-full bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
              onClick={() => {
                setAuthComplete(true);
                setStep("amount");
              }}
            >
              {authComplete ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Bank linked
                </>
              ) : (
                "Simulate Instant Auth"
              )}
            </Button>
          </div>
        )}

        {step === "amount" && (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="deposit-amount">Deposit amount (USD)</Label>
              <Input
                id="deposit-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-2"
              />
            </div>
            <RadioGroup value={speed} onValueChange={(value) => setSpeed(value as AchTransferSpeed)}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3">
                <RadioGroupItem value="standard" className="mt-1" />
                <div>
                  <p className="text-sm font-medium">Standard ACH — 1–3 Days (Free)</p>
                  <p className="text-xs text-muted-foreground">No transfer fee</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3">
                <RadioGroupItem value="instant" className="mt-1" />
                <div>
                  <p className="text-sm font-medium">Instant RTP Transfer (0.5% fee)</p>
                  <p className="text-xs text-muted-foreground">
                    Fee {formatUsd(fee)} · Net credit {formatUsd(netAmount)}
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3 rounded-lg border border-border/60 bg-surface-2/20 p-4 text-sm">
            <Row label="Bank" value={selectedBank?.name ?? "—"} />
            <Row label="Transfer speed" value={speed === "instant" ? "Instant RTP" : "Standard ACH"} />
            <Row label="Gross amount" value={formatUsd(numericAmount)} />
            {speed === "instant" && <Row label="RTP fee (0.5%)" value={formatUsd(fee)} />}
            <Row label="Wallet credit" value={formatUsd(netAmount)} highlight />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step !== "bank" && step !== "confirm" && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() =>
                  setStep(step === "amount" ? "auth" : "bank")
                }
              >
                Back
              </Button>
            )}
            {step === "bank" && (
              <Button type="button" onClick={() => setStep("auth")}>
                Continue
              </Button>
            )}
            {step === "auth" && (
              <Button type="button" onClick={() => setStep("amount")} disabled={!authComplete}>
                Continue
              </Button>
            )}
            {step === "amount" && (
              <Button
                type="button"
                disabled={numericAmount <= 0}
                onClick={() => setStep("confirm")}
              >
                Review transfer
              </Button>
            )}
            {step === "confirm" && (
              <Button
                type="button"
                className="bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
                disabled={submitting || numericAmount <= 0}
                onClick={() => void handleConfirm()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" /> Confirm Transfer
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-[#00E599]" : "font-medium"}>{value}</span>
    </div>
  );
}
