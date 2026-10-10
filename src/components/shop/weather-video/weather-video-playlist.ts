export const HTC_WEATHER_VIDEO_SRC = "/videos/htc-weather-transition.mp4";

/** Total runtime of htc-weather-transition.mp4 (~348s) — used to derive segment offsets. */
export const HTC_WEATHER_VIDEO_DURATION_SEC = 347.951;

export interface WeatherVideoSegment {
  id: string;
  label: string;
  /** Seek target in seconds within the master HTC weather clip. */
  startSec: number;
}

/**
 * Five HTC Sense 3.0–style scenes mapped to even segments of the master transition reel.
 * Adjust `startSec` values if you re-cut the MP4.
 */
export const WEATHER_VIDEO_SEGMENTS: WeatherVideoSegment[] = [
  { id: "sunny", label: "Sunny lens flare", startSec: 0 },
  { id: "rain", label: "Raindrops & windshield", startSec: 69.59 },
  { id: "clouds", label: "Clouds flythrough", startSec: 139.18 },
  { id: "space", label: "Space / galaxy zoom", startSec: 208.77 },
  { id: "snow", label: "Snow storm", startSec: 278.36 },
];

export const WEATHER_IDLE_INTERVAL_MS = 10_000;
export const WEATHER_CROSSFADE_MS = 800;
export const WEATHER_SCROLL_COOLDOWN_MS = 1_200;
export const WEATHER_SCROLL_THRESHOLD_PX = 80;

export const SHOP_WEATHER_BG = "#0b132b";

/** @deprecated Use WEATHER_VIDEO_SEGMENTS */
export const WEATHER_VIDEO_PLAYLIST = WEATHER_VIDEO_SEGMENTS;
