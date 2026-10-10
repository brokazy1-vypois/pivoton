import type { LinkProps } from "@tanstack/react-router";

export type LiquidGlassVariant = "primary" | "outline";

/** Default ripple duration; use `getLiquidGlassRippleMs()` at runtime for reduced-motion. */
export const LIQUID_GLASS_RIPPLE_MS = 700;

export const LIQUID_GLASS_VARIANTS: Record<
  LiquidGlassVariant,
  {
    buttonClass: string;
    hoverGlowClass: string;
    rippleColor: string;
    ringClass: string;
  }
> = {
  primary: {
    buttonClass:
      "border-white/20 bg-primary/75 text-primary-foreground hover:border-primary/40 hover:bg-primary/85",
    hoverGlowClass: "group-hover:shadow-[0_0_28px_-4px] group-hover:shadow-primary/45",
    rippleColor: "var(--color-primary)",
    ringClass: "border-primary/55",
  },
  outline: {
    buttonClass: "border-white/20 bg-white/10 text-foreground hover:border-white/30 hover:bg-white/15",
    hoverGlowClass: "group-hover:shadow-[0_0_24px_-6px] group-hover:shadow-white/20",
    rippleColor: "rgba(255, 255, 255, 0.22)",
    ringClass: "border-white/40",
  },
};

/** Destination page background accent tones for the color-spread transition. */
export function getPageThemeColor(path: string): string {
  if (path.startsWith("/pricing")) {
    return "oklch(0.21 0.055 88)";
  }
  if (path.startsWith("/marketplace")) {
    return "oklch(0.19 0.045 258)";
  }
  return "var(--color-background)";
}

export function resolveRoutePath(to: NonNullable<LinkProps["to"]>): string {
  if (typeof to === "string") return to;
  return "/";
}

export function getRippleMaxRadius(x: number, y: number): number {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}
