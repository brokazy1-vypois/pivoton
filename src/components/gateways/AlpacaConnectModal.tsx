import { Loader2, ShieldCheck } from "lucide-react";
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
import { resolveExchangeRouteLabels } from "@/data/alpaca-exchanges";

interface AlpacaConnectModalProps {
  gatewayId: string | null;
  open: boolean;
  verifying: boolean;
  oauthEnabled: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (gatewayId: string) => void | Promise<void>;
  onCancel: () => void;
}

export function AlpacaConnectModal({
  gatewayId,
  open,
  verifying,
  oauthEnabled,
  onOpenChange,
  onComplete,
  onCancel,
}: AlpacaConnectModalProps) {
  const gateway = gatewayId ? getTradingGateway(gatewayId) : null;
  const routeLabels = gateway ? resolveExchangeRouteLabels(gateway.exchangeRoutes) : [];

  const handleClose = (next: boolean) => {
    if (verifying) return;
    if (!next) onCancel();
    onOpenChange(next);
  };

  const handleAuthorize = () => {
    if (!gatewayId || verifying) return;
    void onComplete(gatewayId);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-lg transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="font-display">Connect via Alpaca Markets</DialogTitle>
          <DialogDescription>
            {gateway
              ? oauthEnabled
                ? `Start Alpaca OAuth 2.0 to map ${gateway.name} to the order routing engine.`
                : `Verify ${gateway.name} against the Alpaca paper API and enable smart routing.`
              : "Select a gateway to begin connection."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#00E599]" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    Step 1 — {oauthEnabled ? "Alpaca OAuth 2.0" : "API verification"}.
                  </span>{" "}
                  {oauthEnabled
                    ? "You will authorize Pivoton via Alpaca Connect and receive a secure access token."
                    : "Pivoton validates connectivity using server-side Alpaca API credentials."}
                </p>
                <p>
                  <span className="font-medium text-foreground">Step 2 — Routing engine sync.</span>{" "}
                  Gateway mapped to smart order routing across NASDAQ, NYSE, Cboe, IEX, and crypto
                  liquidity venues.
                </p>
                <p>
                  <span className="font-medium text-foreground">Step 3 — Ready to reserve.</span>{" "}
                  Connected gateways unlock Fund &amp; Reserve on the Safe Investment Marketplace.
                </p>
              </div>
            </div>
          </div>

          {gateway && (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 p-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Gateway</dt>
                <dd className="mt-1 font-medium">{gateway.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fee schedule</dt>
                <dd className="mt-1 font-medium text-[#00E599]">{gateway.fee}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Asset classes</dt>
                <dd className="mt-1">{gateway.assetClasses.join(" · ")}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Exchange routing capacity</dt>
                <dd className="mt-1">{routeLabels.join(" · ")}</dd>
              </div>
            </dl>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={verifying}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
            disabled={!gatewayId || verifying}
            onClick={handleAuthorize}
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {oauthEnabled ? "Redirecting to Alpaca…" : "Verifying with Alpaca…"}
              </>
            ) : oauthEnabled ? (
              "Continue with Alpaca OAuth"
            ) : (
              "Verify & Connect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
