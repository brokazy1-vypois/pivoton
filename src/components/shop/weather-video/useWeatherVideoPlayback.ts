import { useCallback, useEffect, useRef, useState } from "react";
import {
  WEATHER_IDLE_INTERVAL_MS,
  WEATHER_VIDEO_SEGMENTS,
} from "@/components/shop/weather-video/weather-video-playlist";

interface WeatherVideoPlaybackState {
  sceneIndex: number;
  slotOpacity: [number, number];
  slotSceneIndex: [number, number];
  activeSlot: 0 | 1;
  advanceScene: () => void;
  resetIdleTimer: () => void;
  markVideoError: () => void;
  useFallback: boolean;
}

function nextIndex(current: number, length: number): number {
  return (current + 1) % length;
}

export function useWeatherVideoPlayback(enabled = true): WeatherVideoPlaybackState {
  const playlistLength = WEATHER_VIDEO_SEGMENTS.length;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [slotOpacity, setSlotOpacity] = useState<[number, number]>([1, 0]);
  const [slotSceneIndex, setSlotSceneIndex] = useState<[number, number]>([0, 0]);
  const [useFallback, setUseFallback] = useState(false);

  const sceneIndexRef = useRef(0);
  const activeSlotRef = useRef<0 | 1>(0);
  const idleTimerRef = useRef<number | null>(null);
  const errorCountRef = useRef(0);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const advanceScene = useCallback(() => {
    if (!enabled || useFallback || playlistLength === 0) return;

    clearIdleTimer();

    const current = sceneIndexRef.current;
    const next = nextIndex(current, playlistLength);
    const backSlot: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;

    sceneIndexRef.current = next;
    activeSlotRef.current = backSlot;

    setSlotSceneIndex((prev) => {
      const updated: [number, number] = [...prev];
      updated[backSlot] = next;
      return updated;
    });
    setSlotOpacity(backSlot === 0 ? [0, 1] : [1, 0]);
    setActiveSlot(backSlot);
    setSceneIndex(next);
  }, [clearIdleTimer, enabled, playlistLength, useFallback]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (!enabled || useFallback) return;

    idleTimerRef.current = window.setTimeout(() => {
      advanceScene();
    }, WEATHER_IDLE_INTERVAL_MS);
  }, [advanceScene, clearIdleTimer, enabled, useFallback]);

  const markVideoError = useCallback(() => {
    errorCountRef.current += 1;
    if (errorCountRef.current >= 2) {
      setUseFallback(true);
      clearIdleTimer();
    }
  }, [clearIdleTimer]);

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      return;
    }

    if (typeof window !== "undefined") {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        ?.saveData;
      if (reducedMotion || saveData) {
        setUseFallback(true);
        return;
      }
    }

    resetIdleTimer();
    return () => clearIdleTimer();
  }, [clearIdleTimer, enabled, resetIdleTimer, sceneIndex]);

  return {
    sceneIndex,
    slotOpacity,
    slotSceneIndex,
    activeSlot,
    advanceScene,
    resetIdleTimer,
    markVideoError,
    useFallback,
  };
}

export { WEATHER_CROSSFADE_MS } from "@/components/shop/weather-video/weather-video-playlist";
