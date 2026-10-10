export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Full-page SVG displacement is expensive; skip when user prefers reduced motion. */
export function shouldUseDisplacementFilter(): boolean {
  return !prefersReducedMotion();
}

export function getLiquidGlassRippleMs(): number {
  return prefersReducedMotion() ? 320 : 700;
}
