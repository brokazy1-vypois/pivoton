import { Check, ChevronDown, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useConnectionWithUser } from "@/hooks/useConnectionWithUser";
import { cn } from "@/lib/utils";

interface ConnectButtonProps {
  targetUserId: string;
  className?: string;
}

export function ConnectButton({ targetUserId, className }: ConnectButtonProps) {
  const { user, openAuthModal } = useAuth();
  const {
    connection,
    viewState,
    isLoading,
    isMutating,
    connect,
    accept,
    decline,
    cancel,
    remove,
  } = useConnectionWithUser(user?.id, targetUserId);

  if (!user || user.id === targetUserId) return null;

  const requireAuth = () => {
    if (user) return true;
    openAuthModal("Sign in to connect with other members.");
    return false;
  };

  const handleConnect = async () => {
    if (!requireAuth()) return;
    try {
      await connect();
      toast.success("Connection request sent");
    } catch (error) {
      toast.error("Could not send connection request", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleAccept = async () => {
    if (!connection) return;
    try {
      await accept(connection.id);
      toast.success("Connection accepted");
    } catch (error) {
      toast.error("Could not accept request", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDecline = async () => {
    if (!connection) return;
    try {
      await decline(connection.id);
      toast.message("Request declined");
    } catch (error) {
      toast.error("Could not decline request", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleCancel = async () => {
    if (!connection) return;
    try {
      await cancel(connection.id);
      toast.message("Connection request cancelled");
    } catch (error) {
      toast.error("Could not cancel request", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleRemove = async () => {
    if (!connection) return;
    try {
      await remove(connection.id);
      toast.message("Connection removed");
    } catch (error) {
      toast.error("Could not remove connection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  if (isLoading) {
    return (
      <Button variant="secondary" size="sm" className={cn("w-full", className)} disabled>
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        Connect
      </Button>
    );
  }

  if (viewState === "pending_incoming") {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        <Button
          variant="secondary"
          size="sm"
          disabled={isMutating}
          onClick={() => void handleAccept()}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isMutating}
          onClick={() => void handleDecline()}
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Decline
        </Button>
      </div>
    );
  }

  if (viewState === "pending_outgoing") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className={cn("w-full", className)} disabled={isMutating}>
            Pending
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => void handleCancel()}>
            <X className="mr-2 h-4 w-4" />
            Cancel request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (viewState === "connected") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className={cn("w-full", className)} disabled={isMutating}>
            <Check className="mr-1.5 h-3.5 w-3.5 text-primary" />
            Connected
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => void handleRemove()}>
            <UserMinus className="mr-2 h-4 w-4" />
            Remove connection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn("w-full", className)}
      disabled={isMutating}
      onClick={() => void handleConnect()}
    >
      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      Connect
    </Button>
  );
}
