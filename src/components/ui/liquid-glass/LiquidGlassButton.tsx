import { type LinkProps } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { forwardRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LIQUID_GLASS_VARIANTS, type LiquidGlassVariant } from "@/components/ui/liquid-glass/liquid-glass-theme";
import { useLiquidGlassNavigate } from "@/components/ui/liquid-glass/useLiquidGlassNavigate";

type LiquidGlassSize = "sm" | "default" | "lg";

const sizeClasses: Record<LiquidGlassSize, string> = {
  sm: "h-8 px-3 text-xs rounded-full",
  default: "h-9 px-4 text-sm rounded-xl",
  lg: "h-10 px-8 text-sm rounded-xl",
};

const springTransition = { type: "spring" as const, stiffness: 420, damping: 28 };

export interface LiquidGlassButtonProps {
  to: NonNullable<LinkProps["to"]>;
  search?: LinkProps["search"];
  variant?: LiquidGlassVariant;
  size?: LiquidGlassSize;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}

export const LiquidGlassButton = forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  function LiquidGlassButton(
    { to, search, variant = "primary", size = "default", className, children, disabled },
    ref,
  ) {
    const { navigateWithRipple, isTransitioning } = useLiquidGlassNavigate();
    const theme = LIQUID_GLASS_VARIANTS[variant];
    const isDisabled = disabled || isTransitioning;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      navigateWithRipple({
        x: event.clientX,
        y: event.clientY,
        to,
        search,
        variant,
      });
    };

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={isDisabled}
        onClick={handleClick}
        {...(isDisabled
          ? {}
          : {
              whileHover: { scale: 1.03 },
              whileTap: { scale: 0.98 },
            })}
        transition={springTransition}
        className={cn(
          "group relative isolate inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-medium",
          "border backdrop-blur-md",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_-12px_rgba(0,0,0,0.5)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          theme.buttonClass,
          theme.hoverGlowClass,
          sizeClasses[size],
          className,
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/10"
        />
        <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
      </motion.button>
    );
  },
);
