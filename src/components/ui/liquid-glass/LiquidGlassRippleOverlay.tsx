import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, type Transition } from "framer-motion";
import {
  getPageThemeColor,
  getRippleMaxRadius,
  LIQUID_GLASS_RIPPLE_MS,
  LIQUID_GLASS_VARIANTS,
  type LiquidGlassVariant,
} from "@/components/ui/liquid-glass/liquid-glass-theme";
import {
  getLiquidGlassRippleMs,
  prefersReducedMotion,
} from "@/components/ui/liquid-glass/liquid-glass-motion";
import { useLiquidGlassDisplacement } from "@/components/ui/liquid-glass/useLiquidGlassDisplacement";

interface ActiveRipple {
  x: number;
  y: number;
  variant: LiquidGlassVariant;
  destinationPath: string;
  onNavigate: () => void;
}

interface LiquidGlassRippleOverlayProps {
  ripple: ActiveRipple | null;
  onFinished: () => void;
}

const rippleEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

const RippleCircle = memo(function RippleCircle({
  x,
  y,
  diameter,
  maxRadius,
  className,
  background,
  initial,
  animate,
  transition,
  onComplete,
}: {
  x: number;
  y: number;
  diameter: number;
  maxRadius: number;
  className?: string;
  background?: string;
  initial: { scale: number; opacity?: number };
  animate: { scale: number; opacity?: number };
  transition: Transition;
  onComplete?: () => void;
}) {
  return (
    <motion.div
      aria-hidden
      {...(className ? { className } : {})}
      style={{
        left: x,
        top: y,
        width: diameter,
        height: diameter,
        marginLeft: -maxRadius,
        marginTop: -maxRadius,
        transformOrigin: "center center",
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        ...(background ? { background } : {}),
      }}
      initial={initial}
      animate={animate}
      transition={transition}
      {...(onComplete ? { onAnimationComplete: onComplete } : {})}
    />
  );
});

export const LiquidGlassRippleOverlay = memo(function LiquidGlassRippleOverlay({
  ripple,
  onFinished,
}: LiquidGlassRippleOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    navigatedRef.current = false;
  }, [ripple]);

  useLiquidGlassDisplacement(Boolean(ripple), displacementRef);

  const geometry = useMemo(() => {
    if (!ripple) return null;
    const maxRadius = getRippleMaxRadius(ripple.x, ripple.y);
    return {
      maxRadius,
      diameter: maxRadius * 2,
      destinationColor: getPageThemeColor(ripple.destinationPath),
      variantTheme: LIQUID_GLASS_VARIANTS[ripple.variant],
    };
  }, [ripple]);

  const durationSec = (getLiquidGlassRippleMs() || LIQUID_GLASS_RIPPLE_MS) / 1000;
  const rippleTransition: Transition = useMemo(
    () => ({ duration: durationSec, ease: rippleEase }),
    [durationSec],
  );

  if (!ripple || !mounted || !geometry) return null;

  const { x, y, onNavigate } = ripple;
  const { maxRadius, diameter, destinationColor, variantTheme } = geometry;

  const finishTransition = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    onNavigate();
    onFinished();
  };

  const reducedMotion = prefersReducedMotion();

  return createPortal(
    <>
      {!reducedMotion ? (
        <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
          <defs>
            <filter id="liquid-glass-displacement" x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012"
                numOctaves="2"
                seed={4}
                result="noise"
              />
              <feDisplacementMap
                ref={displacementRef}
                in="SourceGraphic"
                in2="noise"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      ) : null}

      <div aria-hidden className="pointer-events-auto fixed inset-0 z-[9997]" />

      <RippleCircle
        x={x}
        y={y}
        diameter={diameter}
        maxRadius={maxRadius}
        className="pointer-events-none fixed z-[9998] rounded-full"
        background={variantTheme.rippleColor}
        initial={{ scale: 0, opacity: 0.94 }}
        animate={{ scale: 1, opacity: 0.98 }}
        transition={rippleTransition}
      />

      <RippleCircle
        x={x}
        y={y}
        diameter={diameter}
        maxRadius={maxRadius}
        className="pointer-events-none fixed z-[9998] rounded-full"
        background={destinationColor}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...rippleTransition, delay: reducedMotion ? 0 : 0.08 }}
        onComplete={finishTransition}
      />

      {!reducedMotion ? (
        <RippleCircle
          x={x}
          y={y}
          diameter={diameter}
          maxRadius={maxRadius}
          className={`pointer-events-none fixed z-[9999] rounded-full border-2 shadow-[0_0_18px_rgba(255,255,255,0.12)] ${variantTheme.ringClass}`}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 1.04, opacity: 0 }}
          transition={rippleTransition}
        />
      ) : null}
    </>,
    document.body,
  );
});
