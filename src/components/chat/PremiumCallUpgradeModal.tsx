import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChat } from "@/context/ChatContext";

export function PremiumCallUpgradeModal() {
  const { premiumUpgradeOpen, closePremiumUpgrade } = useChat();

  return (
    <Dialog open={premiumUpgradeOpen} onOpenChange={(open) => !open && closePremiumUpgrade()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium calling
          </DialogTitle>
          <DialogDescription>
            P2P Calling is a Premium feature. Upgrade your account to unlock high-definition Audio
            &amp; Video calls.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={closePremiumUpgrade}>
            Not now
          </Button>
          <Button asChild onClick={closePremiumUpgrade}>
            <Link to="/pricing">Upgrade to Premium</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
