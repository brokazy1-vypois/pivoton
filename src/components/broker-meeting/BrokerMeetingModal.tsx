import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { createDailyRoom } from "@/lib/daily";
import { generateMeetingSummary, meetingSummaryToMarkdown } from "@/lib/meeting-summary";
import { saveCallSummary } from "@/services/call-summaries";
import { roomIdFromName } from "@/types/call-summary";
import { useDeepgramTranscription } from "@/hooks/useDeepgramTranscription";
import { useDailyMeeting } from "@/hooks/useDailyMeeting";
import { VideoCallPanel } from "./VideoCallPanel";
import { FinancialNotesPanel } from "./FinancialNotesPanel";
import { PostCallSummaryModal } from "./PostCallSummaryModal";
import type { BrokerRoom, FinancialInsight, MeetingSummary } from "@/types/meeting";

interface BrokerMeetingModalProps {
  room: BrokerRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSummarySaved?: () => void;
}

type ClosePayload = {
  transcript: string;
  insights: FinancialInsight[];
  durationSeconds: number;
};

function MeetingSession({
  room,
  roomUrl,
  onClose,
}: {
  room: BrokerRoom;
  roomUrl: string;
  onClose: (payload: ClosePayload) => void;
}) {
  const meeting = useDailyMeeting(roomUrl);
  const startedAtRef = useRef(Date.now());
  const [insights, setInsights] = useState<FinancialInsight[]>([]);

  const aiActive = meeting.status === "connected" || meeting.status === "fallback";

  const { entries, fullTranscript, isListening, error, stopTranscription } =
    useDeepgramTranscription(aiActive, meeting.mediaStream);

  const handleEndCall = useCallback(async () => {
    stopTranscription();
    await meeting.endMeeting();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onClose({ transcript: fullTranscript, insights, durationSeconds });
  }, [fullTranscript, insights, meeting, onClose, stopTranscription]);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold">{room.room}</p>
          <p className="text-xs text-muted-foreground">
            {room.broker} · {room.license}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void handleEndCall()} aria-label="End call">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <VideoCallPanel
          status={meeting.status}
          connectionError={meeting.error}
          videoRef={meeting.videoRef}
          audioEnabled={meeting.audioEnabled}
          videoEnabled={meeting.videoEnabled}
          onToggleAudio={meeting.toggleAudio}
          onToggleVideo={meeting.toggleVideo}
          onEndCall={() => void handleEndCall()}
          brokerName={room.broker}
          roomName={room.room}
        />
        <FinancialNotesPanel
          entries={entries}
          fullTranscript={fullTranscript}
          isListening={isListening}
          transcriptionError={error}
          onInsightsChange={setInsights}
        />
      </div>
    </>
  );
}

export function BrokerMeetingModal({
  room,
  open,
  onOpenChange,
  onSummarySaved,
}: BrokerMeetingModalProps) {
  const { user } = useAuth();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);

  useEffect(() => {
    if (!open || !room) {
      setRoomUrl(null);
      return;
    }

    let cancelled = false;
    setIsCreatingRoom(true);

    createDailyRoom(room.room)
      .then((url) => {
        if (!cancelled) setRoomUrl(url);
      })
      .catch((err) => {
        toast.error("Failed to start video room", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setIsCreatingRoom(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, room?.room, onOpenChange]);

  const handleClose = useCallback(
    async ({ transcript, insights, durationSeconds }: ClosePayload) => {
      if (!room) return;

      onOpenChange(false);
      setRoomUrl(null);
      setShowSummary(true);
      setIsGeneratingSummary(true);
      setSavedToHistory(false);

      const result = await generateMeetingSummary(transcript, {
        brokerName: room.broker,
        roomName: room.room,
        insights,
      });

      setSummary(result);
      setIsGeneratingSummary(false);

      try {
        await saveCallSummary({
          room_id: roomIdFromName(room.room),
          broker_name: room.broker,
          user_id: user?.id ?? "anonymous",
          full_transcript: transcript.trim() || "(No live transcript captured during this session.)",
          summary_markdown: meetingSummaryToMarkdown(result),
          extracted_tickers: result.tickers.map((t) => t.replace(/^\$/, "")),
          duration_seconds: durationSeconds,
        });
        setSavedToHistory(true);
        toast.success("Summary saved to Private Room history");
        onSummarySaved?.();
      } catch {
        toast.error("Summary generated but could not save to history");
      }
    },
    [onOpenChange, onSummarySaved, room, user?.id],
  );

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    setSummary(null);
    setSavedToHistory(false);
  }, []);

  if (!room) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent
          className="flex h-[90vh] max-h-[900px] w-[95vw] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl [&>button:last-child]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {isCreatingRoom || !roomUrl ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="font-display text-sm font-semibold">{room.room}</p>
                  <p className="text-xs text-muted-foreground">
                    {room.broker} · {room.license}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Setting up secure video room…</p>
              </div>
            </>
          ) : (
            <MeetingSession room={room} roomUrl={roomUrl} onClose={handleClose} />
          )}
        </DialogContent>
      </Dialog>

      <PostCallSummaryModal
        open={showSummary}
        onClose={handleCloseSummary}
        summary={summary}
        isLoading={isGeneratingSummary}
        savedToHistory={savedToHistory}
      />
    </>
  );
}
