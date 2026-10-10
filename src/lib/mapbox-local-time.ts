import tzLookup from "tz-lookup";
import type { GeoCoordinate } from "@/lib/hope-geo";

export type MapboxLightPreset = "dawn" | "day" | "dusk" | "night";

const PRESET_LABELS: Record<MapboxLightPreset, string> = {
  dawn: "Dawn",
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};

export function formatLightPresetLabel(preset: MapboxLightPreset): string {
  return PRESET_LABELS[preset];
}

export function resolveTimezoneAtCoordinate(coordinate: GeoCoordinate): string {
  try {
    return tzLookup(coordinate.latitude, coordinate.longitude);
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

export function getLocalHourAtCoordinate(
  coordinate: GeoCoordinate,
  date = new Date(),
): number {
  const timeZone = resolveTimezoneAtCoordinate(coordinate);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hourPart = parts.find((part) => part.type === "hour");
  return hourPart ? Number.parseInt(hourPart.value, 10) : date.getHours();
}

export function resolveLightPresetFromLocalHour(hour: number): MapboxLightPreset {
  if (hour >= 20 || hour < 5) return "night";
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 18 && hour < 20) return "dusk";
  return "day";
}

export function resolveLightPresetForCoordinate(
  coordinate: GeoCoordinate,
  date = new Date(),
): MapboxLightPreset {
  return resolveLightPresetFromLocalHour(getLocalHourAtCoordinate(coordinate, date));
}

/** Milliseconds until the next local hour boundary for a coordinate. */
export function msUntilNextLocalHour(coordinate: GeoCoordinate, date = new Date()): number {
  const timeZone = resolveTimezoneAtCoordinate(coordinate);
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number.parseInt(local.find((part) => part.type === type)?.value ?? "0", 10);

  const minute = read("minute");
  const second = read("second");
  const remainingMs = (59 - minute) * 60_000 + (60 - second) * 1_000;
  return Math.max(remainingMs, 60_000);
}
