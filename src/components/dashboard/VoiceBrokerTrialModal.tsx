import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface VoiceBrokerTrialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}

export function VoiceBrokerTrialModal({
  open,
  onOpenChange,
  onUpgrade,
}: VoiceBrokerTrialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-[#121824] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Crown className="h-5 w-5 text-primary" />
            Free trial ended
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            Your 60-second free trial for AI Voice Broker has expired. Upgrade to Premium for
            unlimited voice access to portfolio analysis, hedging advice, and live broker-style
            guidance.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={onUpgrade}>
            Upgrade to Premium
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pricing">View plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
