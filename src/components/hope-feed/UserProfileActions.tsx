import { MessageCircle, Mic, Phone, Video } from "lucide-react";
import { toast } from "sonner";
import { ConnectButton } from "@/components/connections/ConnectButton";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useConnectionWithUser } from "@/hooks/useConnectionWithUser";
import type { ChatPeer } from "@/types/chat";

interface UserProfileActionsProps {
  targetUserId: string;
  fullName: string;
  targetAvatar?: string;
  className?: string;
}

export function UserProfileActions({
  targetUserId,
  fullName,
  targetAvatar,
  className,
}: UserProfileActionsProps) {
  const { user, openAuthModal } = useAuth();
  const { openChat, startCall, openPremiumUpgrade } = useChat();
  const { viewState } = useConnectionWithUser(user?.id, targetUserId);
  const isConnected = viewState === "connected";

  const buildPeer = (): ChatPeer => ({
    userId: targetUserId,
    fullName,
    avatar: targetAvatar ?? fullName.slice(0, 2).toUpperCase(),
  });

  const requireAuth = (): boolean => {
    if (user) return true;
    openAuthModal("Sign in to message or call other members.");
    return false;
  };

  const handleMessage = () => {
    if (!requireAuth()) return;
    if (user!.id === targetUserId) {
      toast.message("This is your profile");
      return;
    }
    openChat(buildPeer());
  };

  const handleCall = (mode: "audio" | "video") => {
    if (!requireAuth()) return;
    if (user!.id === targetUserId) {
      toast.message("You cannot call yourself");
      return;
    }
    if (!isConnected) {
      toast.error("You must be connected with this user to initiate calls.");
      return;
    }
    if (!user!.isPremium) {
      openPremiumUpgrade();
      return;
    }
    startCall(buildPeer(), mode);
  };

  return (
    <div className={className}>
      <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleMessage}>
        <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Message
      </Button>

      {user?.isPremium ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto">
              <Phone className="mr-1.5 h-3.5 w-3.5" /> Call
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <div className="grid gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handleCall("audio")}
              >
                <Mic className="mr-2 h-4 w-4" />
                Audio call
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handleCall("video")}
              >
                <Video className="mr-2 h-4 w-4" />
                Video call
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => handleCall("video")}
        >
          <Phone className="mr-1.5 h-3.5 w-3.5" /> Call
        </Button>
      )}

      <ConnectButton targetUserId={targetUserId} className="w-full sm:w-auto" />
    </div>
  );
}
