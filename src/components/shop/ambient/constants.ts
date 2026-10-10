export const SHOP_AMBIENT_BG = "#0b132b";

export const AMBIENT_SCENE_IDS = ["rain", "snow", "leaves", "starfall", "sunny"] as const;

export type AmbientSceneId = (typeof AMBIENT_SCENE_IDS)[number];

export const AMBIENT_SCENE_INTERVAL_MS = 10_000;
export const AMBIENT_SCENE_FADE_MS = 1_200;

export const AMBIENT_SCENE_LABELS: Record<AmbientSceneId, string> = {
  rain: "Rain",
  snow: "Snow",
  leaves: "Windy leaves",
  starfall: "Starfall",
  sunny: "Sunny rays",
};
