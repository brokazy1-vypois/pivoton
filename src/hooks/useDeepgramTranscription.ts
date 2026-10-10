import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "@/types/meeting";

function getDeepgramApiKey(): string {
  const key = import.meta.env.VITE_DEEPGRAM_API_KEY;
  if (!key) throw new Error("VITE_DEEPGRAM_API_KEY is not configured");
  return key;
}

type DeepgramTranscriptMessage = {
  is_final?: boolean;
  channel?: {
    alternatives?: { transcript?: string }[];
  };
};

/**
 * Live transcription — runs independently of Daily.co.
 * Uses the provided audio stream when available, otherwise requests mic access directly.
 */
export function useDeepgramTranscription(
  enabled: boolean,
  audioStream?: MediaStream | null,
) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const entryIdRef = useRef(0);
  const startedRef = useRef(false);

  const fullTranscript = entries
    .filter((e) => e.isFinal)
    .map((e) => e.text)
    .join(" ");

  const stopTranscription = useCallback(() => {
    startedRef.current = false;
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }
    recorderRef.current = null;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    socketRef.current = null;
    ownedStreamRef.current?.getTracks().forEach((t) => t.stop());
    ownedStreamRef.current = null;
    setIsListening(false);
  }, []);

  const startTranscription = useCallback(async () => {
    if (!enabled || startedRef.current) return;

    stopTranscription();
    setError(null);

    const apiKey = getDeepgramApiKey();
    const params = new URLSearchParams({
      model: "nova-2",
      language: "en-US",
      smart_format: "true",
      interim_results: "true",
      punctuate: "true",
    });

    const socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ["token", apiKey],
    );
    socketRef.current = socket;

    const waitForOpen = new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("Deepgram connection failed"));
      setTimeout(() => reject(new Error("Deepgram connection timed out")), 8000);
    });

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as DeepgramTranscriptMessage;
        const text = data.channel?.alternatives?.[0]?.transcript?.trim();
        if (!text) return;

        const isFinal = data.is_final ?? false;
        const id = `t-${++entryIdRef.current}`;

        setEntries((prev) => {
          const finals = prev.filter((e) => e.isFinal);
          return [...finals, { id, text, isFinal, timestamp: Date.now() }];
        });
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => setIsListening(false);

    try {
      await waitForOpen;

      let stream: MediaStream | null = null;

      const externalAudio = audioStream?.getAudioTracks().find((t) => t.readyState === "live");
      if (externalAudio) {
        stream = new MediaStream([externalAudio]);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        ownedStreamRef.current = stream;
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      if (!mimeType) throw new Error("Browser does not support audio recording");

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (evt) => {
        if (evt.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(evt.data);
        }
      });

      recorder.start(250);
      startedRef.current = true;
      setIsListening(true);
    } catch (err) {
      stopTranscription();
      setError(err instanceof Error ? err.message : "Transcription failed to start");
    }
  }, [audioStream, enabled, stopTranscription]);

  useEffect(() => {
    if (enabled) {
      void startTranscription();
    } else {
      stopTranscription();
    }
    return () => stopTranscription();
  }, [enabled, audioStream, startTranscription, stopTranscription]);

  return { entries, fullTranscript, isListening, error, stopTranscription };
}
