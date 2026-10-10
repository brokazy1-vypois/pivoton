import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Loader2,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeetingConnectionStatus } from "@/hooks/useDailyMeeting";

interface VideoCallPanelProps {
  status: MeetingConnectionStatus;
  connectionError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  brokerName: string;
  roomName: string;
}

export function VideoCallPanel({
  status,
  connectionError,
  videoRef,
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  brokerName,
  roomName,
}: VideoCallPanelProps) {
  const isConnected = status === "connected" || status === "fallback";
  const isJoining = status === "joining";

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold">{roomName}</h2>
        <p className="text-sm text-muted-foreground">Live session with {brokerName}</p>
      </div>

      {connectionError && (
        <div
          className={cn(
            "mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
            status === "fallback"
              ? "border border-gold/30 bg-gold/10 text-gold"
              : "border border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {status === "fallback" ? (
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{connectionError}</span>
        </div>
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface-2">
        {isJoining && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-2/90">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connecting to video room…</p>
          </div>
        )}

        {status === "error" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-center text-sm text-destructive">
              Could not start the call. Allow microphone access in your browser and try again.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              AI notes will still work once mic access is granted.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full min-h-[240px] w-full flex-1 object-cover",
                !videoEnabled && "hidden",
              )}
            />
            {!videoEnabled && isConnected && (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 font-display text-2xl font-semibold text-primary">
                  You
                </div>
              </div>
            )}
            {isConnected && (
              <div className="absolute bottom-2 left-2 rounded bg-background/70 px-2 py-0.5 text-xs backdrop-blur-sm">
                You {status === "fallback" ? "· Demo mode" : "· Connected"}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 pt-4">
        <Button
          variant={audioEnabled ? "secondary" : "destructive"}
          size="icon"
          disabled={!isConnected && status !== "error"}
          onClick={onToggleAudio}
          aria-label={audioEnabled ? "Mute" : "Unmute"}
        >
          {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={videoEnabled ? "secondary" : "destructive"}
          size="icon"
          disabled={!isConnected}
          onClick={onToggleVideo}
          aria-label={videoEnabled ? "Stop video" : "Start video"}
        >
          {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button variant="destructive" size="icon" onClick={onEndCall} aria-label="End call">
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
