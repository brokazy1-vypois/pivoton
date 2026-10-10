export type RgbTriplet = readonly [number, number, number];

export interface GoalMeshPalette {
  id: string;
  label: string;
  colors: readonly RgbTriplet[];
  base: RgbTriplet;
}

/** Pastel / neon mesh combinations — one palette is assigned per goal id. */
export const GOAL_MESH_PALETTES: readonly GoalMeshPalette[] = [
  {
    id: "turquoise-purple",
    label: "Turquoise · Purple",
    colors: [
      [64, 224, 208],
      [186, 104, 255],
      [147, 197, 253],
      [236, 72, 153],
    ],
    base: [240, 249, 255],
  },
  {
    id: "pink-yellow",
    label: "Pink · Yellow",
    colors: [
      [255, 105, 180],
      [255, 214, 102],
      [255, 159, 124],
      [250, 204, 21],
    ],
    base: [255, 251, 235],
  },
  {
    id: "blue-mint",
    label: "Blue · Mint",
    colors: [
      [56, 189, 248],
      [52, 211, 153],
      [129, 140, 248],
      [110, 231, 183],
    ],
    base: [236, 254, 255],
  },
  {
    id: "coral-lavender",
    label: "Coral · Lavender",
    colors: [
      [251, 113, 133],
      [196, 181, 253],
      [253, 186, 116],
      [167, 139, 250],
    ],
    base: [255, 247, 237],
  },
  {
    id: "lime-sky",
    label: "Lime · Sky",
    colors: [
      [163, 230, 53],
      [125, 211, 252],
      [74, 222, 128],
      [96, 165, 250],
    ],
    base: [247, 254, 231],
  },
  {
    id: "magenta-azure",
    label: "Magenta · Azure",
    colors: [
      [217, 70, 239],
      [59, 130, 246],
      [244, 114, 182],
      [34, 211, 238],
    ],
    base: [250, 245, 255],
  },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function rgbToHex([r, g, b]: RgbTriplet): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Stable palette for a goal — same goal id always maps to the same colors. */
export function getGoalMeshPalette(goalId: string): GoalMeshPalette {
  const index = hashString(goalId) % GOAL_MESH_PALETTES.length;
  return GOAL_MESH_PALETTES[index]!;
}

/** Slow-cycling Granim gradient states for fluid mesh backgrounds. */
export function paletteToGranimGradients(palette: GoalMeshPalette): string[][] {
  const hex = palette.colors.map(rgbToHex);
  const base = rgbToHex(palette.base);
  const [c0, c1, c2, c3] = hex as [string, string, string, string];

  return [
    [c0, c1, base],
    [c2, c3, c0],
    [c1, c3, base],
    [c0, c2, c1],
    [c3, c0, base],
  ];
}
