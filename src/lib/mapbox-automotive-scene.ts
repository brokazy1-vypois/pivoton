import mapboxgl from "mapbox-gl";
import type { GeoCoordinate } from "@/lib/hope-geo";
import {
  formatLightPresetLabel,
  resolveLightPresetForCoordinate,
  type MapboxLightPreset,
} from "@/lib/mapbox-local-time";

/** Mapbox Standard — 3D landmarks, dynamic lighting, rich POIs. */
export const MAPBOX_STANDARD_STYLE = "mapbox://styles/mapbox/standard";

/** Default driver-perspective camera (low pitch, natural heading). */
export const AUTOMOTIVE_CAMERA = {
  zoom: 15.4,
  pitch: 63,
  bearing: -38,
} as const;

export const AUTOMOTIVE_FLY_TO = {
  pitch: 65,
  bearing: -32,
  zoom: 16.2,
  duration: 1100,
} as const;

export const MAPBOX_STANDARD_BASEMAP_CONFIG = {
  showPointOfInterestLabels: true,
  showPlaceLabels: true,
  showRoadLabels: true,
  showTransitLabels: true,
  show3dObjects: true,
  show3dBuildings: true,
  show3dLandmarks: true,
  show3dTrees: true,
} as const;

export function buildStandardBasemapConfig(lightPreset: MapboxLightPreset) {
  return {
    ...MAPBOX_STANDARD_BASEMAP_CONFIG,
    lightPreset,
  };
}

export function applyMapboxStandardScene(
  map: mapboxgl.Map,
  coordinate: GeoCoordinate,
): MapboxLightPreset {
  const lightPreset = resolveLightPresetForCoordinate(coordinate);

  if (typeof map.setConfigProperty !== "function") {
    return lightPreset;
  }

  try {
    map.setConfigProperty("basemap", "lightPreset", lightPreset);
    for (const [key, value] of Object.entries(MAPBOX_STANDARD_BASEMAP_CONFIG)) {
      map.setConfigProperty("basemap", key, value);
    }
  } catch {
    // Standard config is optional if the token cannot access the style.
  }

  return lightPreset;
}

export function standardMapLegendLabel(lightPreset: MapboxLightPreset): string {
  return `${formatLightPresetLabel(lightPreset)} · Mapbox Standard · Blue = members · Green = you · Teal = hopes · 3D = Avaturn avatar`;
}

export function createMapMarkerElement(options: {
  initials: string;
  title: string;
  ariaLabel: string;
  variant: "self" | "member" | "hope";
  onClick?: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = options.title;
  button.setAttribute("aria-label", options.ariaLabel);
  button.className = [
    "group relative flex flex-col items-center border-0 bg-transparent p-0",
    "cursor-pointer outline-none",
  ].join(" ");

  const glow = document.createElement("span");
  glow.className =
    "absolute -bottom-1 h-2 w-6 rounded-full bg-black/50 blur-[2px] transition-transform group-hover:scale-110";
  glow.setAttribute("aria-hidden", "true");

  const chip = document.createElement("span");
  const variantClass =
    options.variant === "self"
      ? "h-10 w-10 border-2 border-emerald-200 bg-emerald-500 text-[10px] shadow-[0_0_18px_rgba(16,185,129,0.55)]"
      : options.variant === "member"
        ? "h-9 w-9 border-2 border-sky-200 bg-sky-600 text-[10px] shadow-[0_0_16px_rgba(56,189,248,0.45)]"
        : "h-8 w-8 border-2 border-white/90 bg-primary text-[9px] shadow-[0_0_14px_rgba(16,185,129,0.4)]";

  chip.className = [
    "relative z-10 grid place-items-center rounded-full font-bold text-white",
    "transition-transform group-hover:scale-110",
    variantClass,
  ].join(" ");
  chip.textContent = options.initials;

  button.append(glow, chip);

  if (options.onClick) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onClick?.();
    });
  }

  return button;
}

export function attachMapMarker(
  map: mapboxgl.Map,
  element: HTMLElement,
  longitude: number,
  latitude: number,
): mapboxgl.Marker {
  return new mapboxgl.Marker({
    element,
    anchor: "bottom",
    pitchAlignment: "viewport",
    rotationAlignment: "viewport",
    offset: [0, -6],
  })
    .setLngLat([longitude, latitude])
    .addTo(map);
}
