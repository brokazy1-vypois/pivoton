import { useCallback, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoCallPanel } from "@/components/broker-meeting/VideoCallPanel";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useDailyMeeting } from "@/hooks/useDailyMeeting";
import { createPeerCallRoom } from "@/lib/daily";

function PeerCallSession({
  peerName,
  roomUrl,
  callMode,
  onEnd,
}: {
  peerName: string;
  roomUrl: string;
  callMode: "audio" | "video";
  onEnd: () => void;
}) {
  const { user } = useAuth();
  const meeting = useDailyMeeting(roomUrl, {
    userName: user?.fullName ?? "Pivoton Member",
    callMode,
  });

  const handleEnd = useCallback(async () => {
    await meeting.endMeeting();
    onEnd();
  }, [meeting, onEnd]);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold">
            {callMode === "audio" ? "Audio call" : "Video call"}
          </p>
          <p className="text-xs text-muted-foreground">with {peerName}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void handleEnd()} aria-label="End call">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <VideoCallPanel
        status={meeting.status}
        connectionError={meeting.error}
        videoRef={meeting.videoRef}
        audioEnabled={meeting.audioEnabled}
        videoEnabled={meeting.videoEnabled}
        onToggleAudio={meeting.toggleAudio}
        onToggleVideo={meeting.toggleVideo}
        onEndCall={() => void handleEnd()}
        brokerName={peerName}
        roomName={callMode === "audio" ? "Audio session" : "Video session"}
      />
    </>
  );
}

export function PeerCallModal() {
  const { activeCall, setCallRoomUrl, setCallCreating, endCall } = useChat();

  const open = Boolean(activeCall);
  const peer = activeCall?.peer ?? null;
  const mode = activeCall?.mode ?? "video";
  const roomUrl = activeCall?.roomUrl ?? null;
  const isCreating = activeCall?.isCreating ?? false;

  useEffect(() => {
    if (!open || !peer || roomUrl) return;

    let cancelled = false;
    setCallCreating(true);

    createPeerCallRoom({
      displayName: `call-${peer.fullName}`,
      videoEnabled: mode === "video",
    })
      .then((url) => {
        if (!cancelled) setCallRoomUrl(url);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not start call";
        toast.error("Call failed", { description: message });
        endCall();
      })
      .finally(() => {
        if (!cancelled) setCallCreating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, peer, roomUrl, mode, setCallRoomUrl, setCallCreating, endCall]);

  useEffect(() => {
    if (!open) return;
    return () => {
      // Room cleanup handled by useDailyMeeting unmount
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) endCall();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        {isCreating || !roomUrl ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Setting up {mode === "audio" ? "audio" : "video"} call with {peer?.fullName}…
            </p>
          </div>
        ) : (
          <PeerCallSession
            peerName={peer?.fullName ?? "Member"}
            roomUrl={roomUrl}
            callMode={mode}
            onEnd={endCall}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
