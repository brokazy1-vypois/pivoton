import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Phone, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  FinanceAgentMessageBody,
  stripMarkdownForSpeech,
} from "@/components/dashboard/FinanceAgentMessageBody";
import { useFinanceAgent } from "@/context/FinanceAgentContext";
import {
  pickMediaRecorderMimeType,
  transcribeAudioBlob,
} from "@/lib/deepgram-transcribe";
import { RobotSplineEmbed } from "@/components/shared/RobotSplineEmbed";
import { cn } from "@/lib/utils";

function hasDeepgramKey(): boolean {
  return Boolean(import.meta.env.VITE_DEEPGRAM_API_KEY?.trim());
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      AI agent analyzing market data…
    </div>
  );
}

export function AIVoiceBroker() {
  const {
    voiceMessages,
    sendVoiceFinancePrompt,
    isVoiceLoading,
    isLoading,
    voiceStreamingId,
    limitReached,
  } = useFinanceAgent();

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speakVolume, setSpeakVolume] = useState(0);
  const [motionTick, setMotionTick] = useState(0);

  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const sessionIdRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const peakAudioLevelRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelMonitorRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastAutoSpokenIdRef = useRef<string | null>(null);

  const voiceAvailable = hasDeepgramKey();
  const busy = isVoiceLoading || isLoading || isTranscribing;
  const isSpeaking = speakingMessageId !== null;

  const [isStartingMic, setIsStartingMic] = useState(false);

  const MIN_RECORDING_MS = 500;

  const cleanupMicSession = useCallback(() => {
    if (levelMonitorRef.current !== null) {
      window.clearInterval(levelMonitorRef.current);
      levelMonitorRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    peakAudioLevelRef.current = 0;

    if (recorderRef.current?.state !== "inactive") {
      try {
        recorderRef.current?.stop();
      } catch {
        /* recorder may already be torn down */
      }
    }
    recorderRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    peakAudioLevelRef.current = 0;
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);

      levelMonitorRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(bins);
        let sum = 0;
        for (const v of bins) sum += v;
        const avg = sum / bins.length / 255;
        if (avg > peakAudioLevelRef.current) peakAudioLevelRef.current = avg;
      }, 80);
    } catch {
      /* level monitor is optional */
    }
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, []);

  const speakMessage = useCallback(
    (messageId: string, rawText: string) => {
      const text = stripMarkdownForSpeech(rawText);
      if (!text) return;

      cancelSpeech();

      if (typeof window === "undefined" || !window.speechSynthesis) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;

      utterance.onstart = () => setSpeakingMessageId(messageId);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);

      window.speechSynthesis.speak(utterance);
    },
    [cancelSpeech],
  );

  const processVoiceQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        toast.error("No speech recognized. Speak clearly and hold the button a bit longer.");
        return;
      }

      if (limitReached) {
        toast.error("Daily AI limit reached");
        return;
      }

      try {
        await sendVoiceFinancePrompt(trimmed);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Voice agent unavailable");
      }
    },
    [limitReached, sendVoiceFinancePrompt],
  );

  const handleRecorderStop = useCallback(
    async (sessionId: number) => {
      if (sessionId !== sessionIdRef.current) return;

      if (levelMonitorRef.current !== null) {
        window.clearInterval(levelMonitorRef.current);
        levelMonitorRef.current = null;
      }
      void audioContextRef.current?.close();
      audioContextRef.current = null;

      const peakLevel = peakAudioLevelRef.current;

      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      recorderRef.current = null;

      const mimeType = mimeTypeRef.current || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (blob.size < 1000) {
        toast.error("Recording too short. Hold the button at least half a second while speaking.");
        return;
      }

      if (peakLevel < 0.02) {
        toast.error(
          "Microphone picked up silence. Check Mac System Settings → Sound → Input and select the correct device.",
        );
        return;
      }

      setIsTranscribing(true);
      try {
        const transcript = await transcribeAudioBlob(blob, mimeType);
        await processVoiceQuery(transcript);
      } catch (err) {
        console.warn("Transcription error:", err);
        toast.error(
          err instanceof Error ? err.message : "Transcription failed. Check microphone and Deepgram key.",
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [processVoiceQuery],
  );

  const finalizeRecording = useCallback(() => {
    if (startingRef.current) {
      pendingStopRef.current = true;
      return;
    }
    if (!recordingRef.current) return;

    const elapsed = Date.now() - recordingStartedAtRef.current;
    const stopRecorderNow = () => {
      recordingRef.current = false;
      setIsRecording(false);

      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.stop();
      }
    };

    if (elapsed < MIN_RECORDING_MS) {
      window.setTimeout(stopRecorderNow, MIN_RECORDING_MS - elapsed);
    } else {
      stopRecorderNow();
    }
  }, []);

  const requestMicStream = useCallback(async (): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints[] = [
      { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false },
      { audio: true, video: false },
    ];

    let lastError: unknown;
    for (const constraint of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraint);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error("Microphone unavailable");
  }, []);

  const startHoldToTalk = useCallback(async () => {
    if (!voiceAvailable || busy || startingRef.current) {
      if (!voiceAvailable) {
        toast.error("Add VITE_DEEPGRAM_API_KEY to enable voice input.");
      }
      return;
    }

    // Allow recording even while TTS is playing — cancel speech first.
    cancelSpeech();

    const sessionId = ++sessionIdRef.current;
    startingRef.current = true;
    pendingStopRef.current = false;
    setIsStartingMic(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Microphone not supported in this browser.");
        return;
      }

      cleanupMicSession();

      const mimeType = pickMediaRecorderMimeType();
      if (!mimeType) {
        toast.error("This browser does not support audio recording.");
        return;
      }
      mimeTypeRef.current = mimeType;

      const stream = await requestMicStream();
      micStreamRef.current = stream;
      startAudioLevelMonitor(stream);

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch {
        recorder = new MediaRecorder(stream);
        mimeTypeRef.current = recorder.mimeType || mimeType;
      }
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (evt) => {
        if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
      });

      recorder.addEventListener("stop", () => {
        void handleRecorderStop(sessionId);
      });

      // Single blob on stop — produces a valid container file for Deepgram REST API.
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      recordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      console.warn("Microphone error:", err);
      recordingRef.current = false;
      setIsRecording(false);
      cleanupMicSession();
      toast.error("Microphone access denied. Allow mic in browser settings.");
    } finally {
      startingRef.current = false;
      setIsStartingMic(false);
      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        finalizeRecording();
      }
    }
  }, [
    busy,
    cancelSpeech,
    cleanupMicSession,
    finalizeRecording,
    handleRecorderStop,
    requestMicStream,
    startAudioLevelMonitor,
    voiceAvailable,
  ]);

  useEffect(() => {
    const onPointerUp = () => {
      if (recordingRef.current || startingRef.current) {
        finalizeRecording();
      }
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [finalizeRecording]);

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [voiceMessages, isVoiceLoading, voiceStreamingId]);

  useEffect(() => {
    if (isVoiceLoading) return;

    const latestAssistant = [...voiceMessages]
      .reverse()
      .find((m) => m.role === "assistant" && m.text.trim());

    if (
      latestAssistant &&
      latestAssistant.id !== lastAutoSpokenIdRef.current
    ) {
      lastAutoSpokenIdRef.current = latestAssistant.id;
      speakMessage(latestAssistant.id, latestAssistant.text);
    }
  }, [voiceMessages, isVoiceLoading, speakMessage]);

  useEffect(() => {
    if (!isSpeaking) {
      setSpeakVolume(0);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      setSpeakVolume(0.3 + Math.abs(Math.sin(t * 11)) * 0.35 + Math.random() * 0.08);
      setMotionTick(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking]);

  useEffect(() => {
    return () => {
      cancelSpeech();
      cleanupMicSession();
    };
  }, [cancelSpeech, cleanupMicSession]);

  const robotBaseScale = isSpeaking ? 0.86 + speakVolume * 0.025 : 0.86;
  const talkJitterY = isSpeaking ? Math.sin(motionTick * 14) * 1.5 : 0;
  const talkJitterX = isSpeaking ? Math.sin(motionTick * 9) * 0.8 : 0;

  const arcGlow = isRecording || isStartingMic
    ? "radial-gradient(ellipse at bottom, rgba(239, 68, 68, 0.95), transparent 75%)"
    : isSpeaking
      ? "radial-gradient(ellipse at bottom, rgba(16, 185, 129, 0.85), transparent 75%)"
      : isTranscribing || isVoiceLoading
        ? "radial-gradient(ellipse at bottom, rgba(56, 189, 248, 0.55), transparent 75%)"
        : "radial-gradient(ellipse at bottom, rgba(56, 189, 248, 0.35), transparent 75%)";

  return (
    <div className="flex w-full flex-col bg-transparent">
      {/* 3D Robot Avatar — full-width frame, interactive Spline tracking */}
      <div className="relative mx-auto h-[320px] w-full overflow-hidden rounded-3xl border border-slate-800/80 bg-[#080C14]/90 shadow-2xl">
        {/* Ambient glow — must not intercept pointer events */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: isRecording || isStartingMic
              ? "radial-gradient(circle at 50% 38%, rgba(239, 68, 68, 0.35), transparent 72%)"
              : isSpeaking
                ? "radial-gradient(circle at 50% 38%, rgba(16, 185, 129, 0.35), transparent 72%)"
                : "radial-gradient(circle at 50% 38%, rgba(56, 189, 248, 0.15), transparent 68%)",
            filter: `blur(${isRecording || isSpeaking ? 14 : 8}px)`,
          }}
          aria-hidden
        />

        <div className="absolute inset-0 z-[1]">
          <RobotSplineEmbed
            scale={robotBaseScale}
            translateX={talkJitterX}
            translateY={talkJitterY}
          />
        </div>

        {/* Masks Spline badge without blocking hover on the robot */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 z-[3] h-11 w-32 bg-gradient-to-tl from-[#080C14] via-[#080C14]/90 to-transparent"
          aria-hidden
        />

        {/* LED arc base — decorative only, no pointer capture */}
        <div className="pointer-events-none absolute bottom-0 z-[2] flex h-[64px] w-full items-end justify-center overflow-hidden">
          <div
            className={cn(
              "h-[90px] w-[80%] rounded-[100%] transition-all duration-300",
              isRecording && "animate-pulse",
            )}
            style={{
              background: arcGlow,
              filter: `blur(${isRecording || isStartingMic ? 22 : isSpeaking ? 16 : 10}px)`,
            }}
          />
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            void startHoldToTalk();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            finalizeRecording();
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            finalizeRecording();
          }}
          onContextMenu={(e) => e.preventDefault()}
          disabled={busy || !voiceAvailable}
          className={cn(
            "pointer-events-auto absolute bottom-3 left-1/2 z-40 -translate-x-1/2 touch-none select-none rounded-full p-4 shadow-2xl transition-all duration-200 active:scale-95",
            isRecording || isStartingMic
              ? "scale-110 animate-pulse bg-red-500 text-white ring-8 ring-red-500/30"
              : busy
                ? "cursor-not-allowed bg-slate-700 text-slate-400"
                : "cursor-pointer bg-emerald-500 text-white shadow-emerald-500/50 hover:bg-emerald-600",
          )}
          aria-label="Hold to speak"
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording || isStartingMic ? (
            <Mic className="h-6 w-6 animate-bounce" />
          ) : (
            <Phone className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Voice Conversation Timeline */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-[#0B101D] p-4 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Voice conversation</h3>
          {isRecording && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
              Recording… release to send
            </span>
          )}
          {isStartingMic && !isRecording && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
              Accessing microphone…
            </span>
          )}
          {isTranscribing && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">
              Transcribing…
            </span>
          )}
        </div>

        {!voiceAvailable && (
          <p className="mb-3 text-xs text-muted-foreground">
            Add <code className="text-foreground/80">VITE_DEEPGRAM_API_KEY</code> to{" "}
            <code className="text-foreground/80">.env.local</code> and restart the dev server.
          </p>
        )}

        <div
          ref={timelineRef}
          className="custom-scrollbar max-h-[320px] space-y-4 overflow-y-auto pr-1"
        >
          {voiceMessages.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Hold the call button to speak. Your voice exchanges will appear here — separate from
              the chat above.
            </p>
          ) : (
            voiceMessages.map((m) => (
              <div
                key={m.id}
                className={cn(m.role === "user" ? "flex justify-end" : "flex justify-start")}
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%]">
                    <div className="mb-1 text-right text-[10px] text-muted-foreground/70">
                      You · {formatTimestamp(m.timestamp)}
                    </div>
                    <p className="rounded-lg border border-slate-700/50 bg-slate-900/80 px-4 py-2.5 text-sm text-foreground">
                      {m.text}
                    </p>
                  </div>
                ) : m.text ? (
                  <div className="max-w-[95%]">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/70">
                        AI Finance Agent · {formatTimestamp(m.timestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakMessage(m.id, m.text)}
                        className={cn(
                          "rounded-md p-1 transition-colors",
                          speakingMessageId === m.id
                            ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40"
                            : "text-muted-foreground hover:bg-slate-800 hover:text-emerald-400",
                        )}
                        aria-label="Read message aloud"
                      >
                        <Volume2
                          className={cn(
                            "h-3.5 w-3.5",
                            speakingMessageId === m.id && "animate-pulse",
                          )}
                        />
                      </button>
                    </div>
                    <FinanceAgentMessageBody text={m.text} />
                  </div>
                ) : isVoiceLoading && m.id === voiceStreamingId ? (
                  <TypingIndicator />
                ) : null}
              </div>
            ))
          )}

          {isVoiceLoading && !voiceStreamingId && <TypingIndicator />}
        </div>
      </div>
    </div>
  );
}
