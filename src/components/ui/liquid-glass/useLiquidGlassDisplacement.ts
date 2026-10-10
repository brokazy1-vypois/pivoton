import { useEffect, type RefObject } from "react";
import { LIQUID_GLASS_RIPPLE_MS } from "@/components/ui/liquid-glass/liquid-glass-theme";
import {
  getLiquidGlassRippleMs,
  prefersReducedMotion,
  shouldUseDisplacementFilter,
} from "@/components/ui/liquid-glass/liquid-glass-motion";

const APP_ROOT_ID = "app-root";
const FILTER_ID = "liquid-glass-displacement";

export function useLiquidGlassDisplacement(
  active: boolean,
  displacementRef: RefObject<SVGFEDisplacementMapElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    const appRoot = document.getElementById(APP_ROOT_ID);
    const reducedMotion = prefersReducedMotion();
    const useFilter = shouldUseDisplacementFilter();
    const durationMs = getLiquidGlassRippleMs() || LIQUID_GLASS_RIPPLE_MS;

    if (appRoot) {
      appRoot.style.willChange = "transform";
      if (useFilter) appRoot.style.transform = "translateZ(0)";
    }

    const shakeKeyframes = reducedMotion
      ? [{ x: 0, y: 0 }]
      : [
          { x: 0, y: 0 },
          { x: -1, y: 0.5 },
          { x: 1, y: -0.5 },
          { x: 0, y: 0 },
        ];

    let rafId = 0;
    const start = performance.now();
    let lastDisplacementWrite = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const shakeIndex = Math.min(
        shakeKeyframes.length - 1,
        Math.floor(progress * (shakeKeyframes.length - 1)),
      );
      const shake = shakeKeyframes[shakeIndex] ?? { x: 0, y: 0 };

      if (appRoot) {
        appRoot.style.transform = `translate3d(${shake.x}px, ${shake.y}px, 0)`;
      }

      if (useFilter && now - lastDisplacementWrite >= 32) {
        lastDisplacementWrite = now;
        const scale = Math.sin(progress * Math.PI) * 12;
        displacementRef.current?.setAttribute("scale", String(scale));
        if (appRoot) {
          appRoot.style.filter = scale > 0.35 ? `url(#${FILTER_ID})` : "";
        }
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else if (appRoot) {
        appRoot.style.filter = "";
        appRoot.style.transform = "";
        appRoot.style.willChange = "";
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (appRoot) {
        appRoot.style.filter = "";
        appRoot.style.transform = "";
        appRoot.style.willChange = "";
      }
      displacementRef.current?.setAttribute("scale", "0");
    };
  }, [active, displacementRef]);
}
