import { type LinkProps } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { memo, useCallback, useEffect, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { EmeraldLiquidLayer } from "@/components/ui/liquid-glass/EmeraldLiquidLayer";
import { useLiquidGlassNavigate } from "@/components/ui/liquid-glass/useLiquidGlassNavigate";
import { useRoutePrefetch } from "@/components/ui/liquid-glass/useRoutePrefetch";
import type { LiquidGlassVariant } from "@/components/ui/liquid-glass/liquid-glass-theme";

export interface LiquidGlassCapsuleAction {
  label: string;
  to: NonNullable<LinkProps["to"]>;
  search?: LinkProps["search"];
  variant: LiquidGlassVariant;
  icon?: LucideIcon;
}

export interface LiquidGlassCapsuleProps {
  primary: LiquidGlassCapsuleAction;
  secondary: LiquidGlassCapsuleAction;
  className?: string;
}

const CapsuleAction = memo(function CapsuleAction({
  action,
  isPrimary,
  isHovered,
  onHover,
  onLeave,
  disabled,
  onNavigate,
}: {
  action: LiquidGlassCapsuleAction;
  isPrimary: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  disabled: boolean;
  onNavigate: (event: MouseEvent<HTMLButtonElement>, action: LiquidGlassCapsuleAction) => void;
}) {
  const Icon = action.icon ?? (isPrimary ? ArrowRight : undefined);

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={(event) => onNavigate(event, action)}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      {...(disabled ? {} : { whileTap: { scale: 0.98 } })}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "relative z-10 inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium sm:px-7 sm:py-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        isPrimary
          ? "font-semibold text-emerald-50 drop-shadow-[0_0_14px_rgba(16,185,129,0.55)]"
          : "text-white/90 hover:text-white",
      )}
    >
      <span className="relative z-[1]">{action.label}</span>
      {Icon ? (
        <motion.span
          className="relative z-[1] inline-flex"
          animate={{ x: isPrimary && isHovered ? 4 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </motion.span>
      ) : null}
      {isPrimary ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-1 rounded-full transition-opacity duration-300",
            isHovered
              ? "bg-emerald-400/20 opacity-100 shadow-[0_0_28px_rgba(16,185,129,0.45)]"
              : "opacity-0",
          )}
        />
      ) : null}
    </motion.button>
  );
});

export const LiquidGlassCapsule = memo(function LiquidGlassCapsule({
  primary,
  secondary,
  className,
}: LiquidGlassCapsuleProps) {
  const { navigateWithRipple, isTransitioning } = useLiquidGlassNavigate();
  const { prefetchRoute } = useRoutePrefetch();
  const [capsuleHovered, setCapsuleHovered] = useState(false);
  const [primaryHovered, setPrimaryHovered] = useState(false);

  useEffect(() => {
    prefetchRoute({ to: primary.to, search: primary.search });
    prefetchRoute({ to: secondary.to, search: secondary.search });
  }, [prefetchRoute, primary, secondary]);

  const handleNavigate = useCallback(
    (event: MouseEvent<HTMLButtonElement>, action: LiquidGlassCapsuleAction) => {
      if (isTransitioning) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      navigateWithRipple({
        x: event.clientX,
        y: event.clientY,
        to: action.to,
        search: action.search,
        variant: action.variant,
      });
    },
    [isTransitioning, navigateWithRipple],
  );

  const handleCapsuleEnter = useCallback(() => {
    setCapsuleHovered(true);
    prefetchRoute({ to: primary.to, search: primary.search });
    prefetchRoute({ to: secondary.to, search: secondary.search });
  }, [prefetchRoute, primary, secondary]);

  const waveIntensified = capsuleHovered || primaryHovered;

  return (
    <div
      data-liquid-glass-capsule
      onMouseEnter={handleCapsuleEnter}
      onMouseLeave={() => setCapsuleHovered(false)}
      className={cn(
        "group/capsule relative inline-flex overflow-hidden rounded-full",
        "border border-white/20 bg-white/[0.06] p-1 backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_40px_-18px_rgba(0,0,0,0.65)]",
        "transition-[box-shadow,border-color] duration-300 will-change-transform",
        capsuleHovered &&
          "border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_0_0_1px_rgba(255,255,255,0.18),0_0_32px_-8px_rgba(16,185,129,0.35),0_16px_48px_-20px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
      />

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/22 via-white/5 to-transparent opacity-90"
      />

      <EmeraldLiquidLayer intensified={waveIntensified} />

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full border border-white/10 transition-opacity duration-300",
          capsuleHovered ? "opacity-100" : "opacity-65",
        )}
      />

      <div className="relative flex w-full min-w-[min(100%,20rem)] items-stretch sm:min-w-[28rem]">
        <CapsuleAction
          action={primary}
          isPrimary
          isHovered={primaryHovered}
          onHover={() => setPrimaryHovered(true)}
          onLeave={() => setPrimaryHovered(false)}
          disabled={isTransitioning}
          onNavigate={handleNavigate}
        />

        <div
          aria-hidden
          className="my-2 w-px shrink-0 self-stretch bg-gradient-to-b from-white/5 via-white/25 to-white/5"
        />

        <CapsuleAction
          action={secondary}
          isPrimary={false}
          isHovered={false}
          onHover={() => undefined}
          onLeave={() => undefined}
          disabled={isTransitioning}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
});
