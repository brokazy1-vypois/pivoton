import { useEffect, useRef } from "react";
import {
  WEATHER_SCROLL_COOLDOWN_MS,
  WEATHER_SCROLL_THRESHOLD_PX,
} from "@/components/shop/weather-video/weather-video-playlist";

interface UseScrollWeatherTriggerOptions {
  enabled?: boolean;
  onTrigger: () => void;
  thresholdPx?: number;
  cooldownMs?: number;
}

/**
 * Scroll-triggered weather scene advance with throttle/cooldown
 * to avoid rapid flicker during heavy scrolling.
 */
export function useScrollWeatherTrigger({
  enabled = true,
  onTrigger,
  thresholdPx = WEATHER_SCROLL_THRESHOLD_PX,
  cooldownMs = WEATHER_SCROLL_COOLDOWN_MS,
}: UseScrollWeatherTriggerOptions) {
  const lastScrollYRef = useRef(0);
  const accumulatedRef = useRef(0);
  const lastFireRef = useRef(0);
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const now = performance.now();
      const currentY = window.scrollY;
      const delta = Math.abs(currentY - lastScrollYRef.current);
      lastScrollYRef.current = currentY;
      accumulatedRef.current += delta;

      if (accumulatedRef.current < thresholdPx) return;
      if (now - lastFireRef.current < cooldownMs) return;

      accumulatedRef.current = 0;
      lastFireRef.current = now;
      onTriggerRef.current();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled, thresholdPx, cooldownMs]);
}
