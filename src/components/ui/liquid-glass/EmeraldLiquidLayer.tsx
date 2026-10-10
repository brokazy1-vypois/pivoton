import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/components/ui/liquid-glass/liquid-glass-motion";

interface EmeraldLiquidLayerProps {
  intensified?: boolean;
}

export const EmeraldLiquidLayer = memo(function EmeraldLiquidLayer({
  intensified = false,
}: EmeraldLiquidLayerProps) {
  const [visible, setVisible] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const node = document.querySelector("[data-liquid-glass-capsule]");
    if (!node || !(node instanceof HTMLElement)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const animateWaves = visible && !reducedMotion;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[36%] overflow-hidden rounded-[inherit]"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#059669] via-[#10b981]/90 to-[#10b981]/20" />

      {animateWaves ? (
        <>
          <div
            className={cn(
              "liquid-glass-wave liquid-glass-wave--a absolute -left-[12%] -right-[12%] bottom-[-10%] h-[72%] mix-blend-overlay opacity-75",
              intensified && "liquid-glass-wave--fast",
            )}
          >
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-full w-full">
              <path
                d="M0,72 C180,24 360,96 540,56 C720,16 900,88 1080,48 C1140,36 1200,60 1200,60 L1200,120 L0,120 Z"
                fill="#34d399"
                fillOpacity="0.55"
              />
            </svg>
          </div>

          <div
            className={cn(
              "liquid-glass-wave liquid-glass-wave--b absolute -left-[8%] -right-[8%] bottom-[-6%] h-[58%] mix-blend-soft-light opacity-60",
              intensified && "liquid-glass-wave--fast",
            )}
          >
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-full w-full">
              <path
                d="M0,56 C220,104 440,32 660,72 C880,112 1020,40 1200,64 L1200,120 L0,120 Z"
                fill="#6ee7b7"
                fillOpacity="0.45"
              />
            </svg>
          </div>

          <div
            className={cn(
              "liquid-glass-shimmer absolute inset-0 mix-blend-overlay opacity-40",
              intensified && "liquid-glass-shimmer--fast",
            )}
          />
        </>
      ) : null}

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent" />
    </div>
  );
});
