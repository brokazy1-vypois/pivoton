import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  HTC_WEATHER_VIDEO_SRC,
  SHOP_WEATHER_BG,
  WEATHER_CROSSFADE_MS,
  WEATHER_VIDEO_SEGMENTS,
  type WeatherVideoSegment,
} from "@/components/shop/weather-video/weather-video-playlist";
import { useScrollWeatherTrigger } from "@/components/shop/weather-video/useScrollWeatherTrigger";
import { useWeatherVideoPlayback } from "@/components/shop/weather-video/useWeatherVideoPlayback";

/** Crops baked-in letterbox/pillarbox from the HTC capture so video fills the viewport. */
const VIDEO_COVER_SCALE = 1.55;

interface ShoppingWeatherVideoBackgroundProps {
  enabled?: boolean;
  className?: string;
}

function WeatherVideoSlot({
  segment,
  opacity,
  onError,
}: {
  segment: WeatherVideoSegment;
  opacity: number;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const seekAndPlay = () => {
      if (cancelled) return;
      video.currentTime = segment.startSec;
      void video.play().catch(onError);
    };

    if (video.readyState >= 1) {
      seekAndPlay();
    } else {
      video.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", seekAndPlay);
    };
  }, [segment.id, segment.startSec, onError]);

  return (
    <video
      ref={videoRef}
      className="pointer-events-none absolute left-1/2 top-1/2 min-h-full min-w-full object-cover"
      style={{
        width: "100vw",
        height: "100vh",
        opacity,
        transform: `translate(-50%, -50%) scale(${VIDEO_COVER_SCALE})`,
        transition: `opacity ${WEATHER_CROSSFADE_MS}ms ease-in-out`,
      }}
      src={HTC_WEATHER_VIDEO_SRC}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onError={onError}
    />
  );
}

/**
 * Full-viewport HTC weather video background (portaled to `document.body`).
 * Mode A: auto-advance segment every 10s when idle.
 * Mode B: scroll advances segment + resets idle timer.
 */
export function ShoppingWeatherVideoBackground({
  enabled = true,
  className,
}: ShoppingWeatherVideoBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const { slotOpacity, slotSceneIndex, advanceScene, resetIdleTimer, markVideoError, useFallback } =
    useWeatherVideoPlayback(enabled);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleScrollTrigger = useCallback(() => {
    advanceScene();
    resetIdleTimer();
  }, [advanceScene, resetIdleTimer]);

  useScrollWeatherTrigger({
    enabled: enabled && !useFallback,
    onTrigger: handleScrollTrigger,
  });

  useEffect(() => {
    if (!enabled) return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = HTC_WEATHER_VIDEO_SRC;
    document.head.appendChild(link);

    return () => link.remove();
  }, [enabled]);

  if (!enabled || !mounted) return null;

  const layer = useFallback ? (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 h-[100dvh] w-[100dvw] max-w-none",
        className,
      )}
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, #132035 0%, ${SHOP_WEATHER_BG} 55%, #070b14 100%)`,
      }}
    />
  ) : (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 h-[100dvh] w-[100dvw] max-w-none overflow-hidden",
        className,
      )}
      style={{ backgroundColor: SHOP_WEATHER_BG }}
    >
      <WeatherVideoSlot segment={WEATHER_VIDEO_SEGMENTS[slotSceneIndex[0] ?? 0]!} opacity={slotOpacity[0]} onError={markVideoError} />
      <WeatherVideoSlot segment={WEATHER_VIDEO_SEGMENTS[slotSceneIndex[1] ?? 0]!} opacity={slotOpacity[1]} onError={markVideoError} />

      <div className="absolute inset-0 h-full w-full bg-slate-900/60 backdrop-blur-[4px]" />
    </div>
  );

  return createPortal(layer, document.body);
}
