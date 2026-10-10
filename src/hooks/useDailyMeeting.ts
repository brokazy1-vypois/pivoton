import { useCallback, useEffect, useRef, useState } from "react";
import Daily, { type DailyCall, type DailyParticipant } from "@daily-co/daily-js";

export type MeetingConnectionStatus =
  | "idle"
  | "joining"
  | "connected"
  | "fallback"
  | "error";

export interface UseDailyMeetingOptions {
  userName?: string;
  callMode?: "audio" | "video";
}

interface UseDailyMeetingResult {
  status: MeetingConnectionStatus;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream: MediaStream | null;
  callObject: DailyCall | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endMeeting: () => Promise<void>;
}

async function destroyExistingInstance() {
  const existing = Daily.getCallInstance();
  if (existing && !existing.isDestroyed()) {
    try {
      await existing.leave();
    } catch {
      // ignore
    }
    await existing.destroy();
  }
}

function getLocalMediaStream(call: DailyCall): MediaStream | null {
  const local = call.participants().local as DailyParticipant | undefined;
  const tracks: MediaStreamTrack[] = [];
  const audio = local?.tracks?.audio?.persistentTrack ?? local?.tracks?.audio?.track;
  const video = local?.tracks?.video?.persistentTrack ?? local?.tracks?.video?.track;
  if (audio?.readyState === "live") tracks.push(audio);
  if (video?.readyState === "live") tracks.push(video);
  return tracks.length > 0 ? new MediaStream(tracks) : null;
}

function attachLocalVideo(
  videoEl: HTMLVideoElement | null,
  callObject: DailyCall | null,
  fallbackStream: MediaStream | null,
) {
  if (!videoEl) return;

  if (callObject) {
    const local = callObject.participants().local as DailyParticipant | undefined;
    const videoTrack =
      local?.tracks?.video?.persistentTrack ?? local?.tracks?.video?.track;
    if (videoTrack && videoTrack.readyState === "live") {
      videoEl.srcObject = new MediaStream([videoTrack]);
      void videoEl.play().catch(() => {});
      return;
    }
  }

  if (fallbackStream) {
    videoEl.srcObject = fallbackStream;
    void videoEl.play().catch(() => {});
  }
}

export function useDailyMeeting(
  roomUrl: string | null,
  options?: UseDailyMeetingOptions,
): UseDailyMeetingResult {
  const callMode = options?.callMode ?? "video";
  const userName = options?.userName ?? "Pivoton Member";
  const [status, setStatus] = useState<MeetingConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const callRef = useRef<DailyCall | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackStreamRef = useRef<MediaStream | null>(null);

  const endMeeting = useCallback(async () => {
    if (callRef.current && !callRef.current.isDestroyed()) {
      try {
        await callRef.current.leave();
      } catch {
        // ignore
      }
      await callRef.current.destroy();
    }
    callRef.current = null;

    fallbackStreamRef.current?.getTracks().forEach((t) => t.stop());
    fallbackStreamRef.current = null;
    setMediaStream(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!roomUrl) return;

    let cancelled = false;

    async function connect() {
      setStatus("joining");
      setError(null);

      try {
        await destroyExistingInstance();

        const call = Daily.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        callRef.current = call;

        call.on("joined-meeting", () => {
          if (cancelled) return;
          attachLocalVideo(videoRef.current, call, null);
        });

        call.on("participant-updated", () => {
          if (cancelled) return;
          attachLocalVideo(videoRef.current, call, null);
        });

        call.on("track-started", (ev) => {
          if (cancelled || !ev.participant?.local) return;
          attachLocalVideo(videoRef.current, call, null);
          const stream = getLocalMediaStream(call);
          if (stream) setMediaStream(stream);
        });

        call.on("camera-error", (ev) => {
          if (cancelled) return;
          const msg =
            ev && typeof ev === "object" && "errorMsg" in ev
              ? String(ev.errorMsg)
              : "Camera/mic access issue";
          setError(msg);
        });

        // Step 1: join without requiring camera/mic (avoids permission-block failures)
        await call.join({
          url: roomUrl,
          userName,
          startVideoOff: true,
          startAudioOff: true,
        });

        if (cancelled) return;

        try {
          if (callMode === "audio") {
            await call.startCamera({ videoSource: false, audioSource: true });
            setAudioEnabled(true);
            setVideoEnabled(false);
          } else {
            await call.startCamera({ videoSource: true, audioSource: true });
            setAudioEnabled(true);
            setVideoEnabled(true);
          }
        } catch {
          setAudioEnabled(call.localAudio());
          setVideoEnabled(call.localVideo());
          setError("Joined audio-only — enable camera/mic in browser settings if needed.");
        }

        attachLocalVideo(videoRef.current, call, null);
        const stream = getLocalMediaStream(call);
        if (stream) setMediaStream(stream);

        // Mark ready only after media setup — prevents AI from grabbing mic too early
        if (!cancelled) setStatus("connected");
      } catch (dailyErr) {
        if (cancelled) return;

        // Fallback: local webcam + mic (AI notes still work, no Daily required)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          fallbackStreamRef.current = stream;
          setMediaStream(stream);
          setStatus("fallback");
          setError(
            dailyErr instanceof Error
              ? `Video room unavailable (${dailyErr.message}). Running local demo mode — AI notes are active.`
              : "Video room unavailable. Running local demo mode — AI notes are active.",
          );
          attachLocalVideo(videoRef.current, null, stream);
        } catch {
          setStatus("error");
          setError(
            dailyErr instanceof Error
              ? dailyErr.message
              : "Could not connect. Allow microphone access and try again.",
          );
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      void endMeeting();
    };
  }, [roomUrl, endMeeting, callMode, userName]);

  const toggleAudio = useCallback(() => {
    const call = callRef.current;
    if (call && !call.isDestroyed() && status === "connected") {
      const next = !call.localAudio();
      call.setLocalAudio(next);
      setAudioEnabled(next);
      return;
    }

    const stream = fallbackStreamRef.current;
    if (stream) {
      const next = !audioEnabled;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
      setAudioEnabled(next);
    }
  }, [audioEnabled, status]);

  const toggleVideo = useCallback(() => {
    const call = callRef.current;
    if (call && !call.isDestroyed() && status === "connected") {
      const next = !call.localVideo();
      call.setLocalVideo(next);
      setVideoEnabled(next);
      return;
    }

    const stream = fallbackStreamRef.current;
    if (stream) {
      const next = !videoEnabled;
      stream.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
      setVideoEnabled(next);
      attachLocalVideo(videoRef.current, null, stream);
    }
  }, [status, videoEnabled]);

  return {
    status,
    error,
    videoRef,
    mediaStream,
    callObject: callRef.current,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    endMeeting,
  };
}
