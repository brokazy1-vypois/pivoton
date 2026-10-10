import { useNavigate, type LinkProps } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  resolveRoutePath,
  type LiquidGlassVariant,
} from "@/components/ui/liquid-glass/liquid-glass-theme";
import { useLiquidGlassRipple } from "@/components/ui/liquid-glass/useLiquidGlassRipple";

interface LiquidGlassNavigateOptions {
  x: number;
  y: number;
  to: NonNullable<LinkProps["to"]>;
  search?: LinkProps["search"];
  variant: LiquidGlassVariant;
}

export function useLiquidGlassNavigate() {
  const navigate = useNavigate();
  const { triggerRipple, isTransitioning } = useLiquidGlassRipple();

  const navigateWithRipple = useCallback(
    ({ x, y, to, search, variant }: LiquidGlassNavigateOptions) => {
      if (isTransitioning) return;

      const run = () => {
        triggerRipple({
          x,
          y,
          variant,
          destinationPath: resolveRoutePath(to),
          onNavigate: () => {
            if (search !== undefined) {
              void navigate({ to, search } as Parameters<typeof navigate>[0]);
              return;
            }
            void navigate({ to } as Parameters<typeof navigate>[0]);
          },
        });
      };

      // Yield the click handler so input isn't blocked by transition setup.
      requestAnimationFrame(run);
    },
    [isTransitioning, navigate, triggerRipple],
  );

  return { navigateWithRipple, isTransitioning };
}
