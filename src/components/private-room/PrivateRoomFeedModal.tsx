import { useCallback, useMemo, useState } from "react";
import { Lock, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useBrokerKyc } from "@/context/BrokerKycContext";
import { SEED_RECOMMENDATIONS } from "@/data/seed-recommendations";
import { RecommendationCard } from "./RecommendationCard";
import { SignalPostCreator } from "./SignalPostCreator";
import { isRecommendationOwner, type SignalRecommendation } from "@/types/signal-feed";
import type { BrokerRoom } from "@/types/meeting";

interface PrivateRoomFeedModalProps {
  room: BrokerRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivateRoomFeedModal({ room, open, onOpenChange }: PrivateRoomFeedModalProps) {
  const { profile, canPostRecommendations } = useBrokerKyc();
  const [posts, setPosts] = useState<SignalRecommendation[]>(SEED_RECOMMENDATIONS);

  const roomPosts = useMemo(() => {
    if (!room) return [];
    return posts
      .filter((p) => p.roomId === room.room)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts, room]);

  const handlePost = useCallback((rec: SignalRecommendation) => {
    setPosts((prev) => [rec, ...prev]);
  }, []);

  const handleAnalysisComplete = useCallback(
    (id: string, update: Partial<SignalRecommendation>) => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...update } : p)));
    },
    [],
  );

  const handleCloseTrade = useCallback((id: string, exitPrice: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "CLOSED" as const,
              closePrice: exitPrice,
              closedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  }, []);

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[880px] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <DialogTitle className="font-display">{room.room}</DialogTitle>
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            Signal feed · {room.broker} · {room.members} members
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Private room
            </Badge>
            {canPostRecommendations ? (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Posting enabled</Badge>
            ) : (
              <Badge variant="outline">View only</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-4 pb-4">
            {roomPosts.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No recommendations yet. Approved brokers can post the first signal.
              </p>
            ) : (
              roomPosts.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  isOwner={isRecommendationOwner(rec, profile.brokerKey, profile.displayName)}
                  onCloseTrade={handleCloseTrade}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border px-5 py-4">
          <SignalPostCreator
            roomId={room.room}
            onPost={handlePost}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
