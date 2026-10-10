import type { Application } from "@splinetool/runtime";

/**
 * Speed up the scene's native LookAt — same direction as the dashboard iframe.
 * We do NOT manually rotate the head; that caused inverted yaw/pitch vs Spline's built-in action.
 */
export function attachFastHeadTracking(app: Application): () => void {
  app.setGlobalEvents(true);

  try {
    const vars = app.getVariables();
    const updates: Record<string, number> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value !== "number") continue;
      const k = key.toLowerCase();
      if (k.includes("damp")) updates[key] = 0;
      if (k.includes("speed") || k.includes("stiff")) updates[key] = Math.max(value, 24);
    }
    if (Object.keys(updates).length > 0) app.setVariables(updates);
  } catch {
    // Scene may not expose tunable variables.
  }

  return () => undefined;
}
