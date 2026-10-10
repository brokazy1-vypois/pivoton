import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioAnalyzerState {
  amplitude: number;
  frequencyData: Uint8Array | null;
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
}

/**
 * Captures live microphone input and exposes normalized amplitude + frequency bins
 * via Web Audio API AnalyserNode.
 */
export function useAudioAnalyzer(enabled: boolean): AudioAnalyzerState {
  const [amplitude, setAmplitude] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current?.state !== "closed") {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    ownedStreamRef.current?.getTracks().forEach((track) => track.stop());
    ownedStreamRef.current = null;

    dataArrayRef.current = null;
    setStream(null);
    setIsActive(false);
    setAmplitude(0);
    setFrequencyData(null);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const buffer = dataArrayRef.current;
    if (!analyser || !buffer) return;

    analyser.getByteFrequencyData(buffer);
    setFrequencyData(new Uint8Array(buffer));

    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      sum += buffer[i]!;
    }
    const avg = sum / buffer.length / 255;
    setAmplitude((prev) => prev * 0.65 + avg * 0.35);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      ownedStreamRef.current = mediaStream;
      setStream(mediaStream);

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const source = ctx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setIsActive(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stop();
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, [stop, tick]);

  useEffect(() => {
    if (enabled) {
      void start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, start, stop]);

  return { amplitude, frequencyData, stream, isActive, error };
}
