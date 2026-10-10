import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GatewayRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GatewayRequiredModal({ open, onOpenChange }: GatewayRequiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-md transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-5 w-5 text-gold" />
            Trading Gateway Required
          </DialogTitle>
          <DialogDescription>
            Please connect at least one brokerage gateway via Alpaca before placing reserves.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:flex-col">
          <Button
            asChild
            className="w-full bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
            onClick={() => onOpenChange(false)}
          >
            <Link to="/marketplace" search={{ tab: "gateways" }}>
              Navigate to Trading Gateways
            </Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
