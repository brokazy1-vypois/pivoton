import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getGoalMeshPalette, type RgbTriplet } from "@/lib/goal-mesh-palettes";
import { GranimMeshBackground } from "@/components/hope-feed/timeline-effects/GranimMeshBackground";

function rgbString([r, g, b]: RgbTriplet): string {
  return `${r}, ${g}, ${b}`;
}

export interface FinalGoalMeshCardProps {
  children: ReactNode;
  /** All steps verified — enables Granim mesh gradient mode. */
  active?: boolean;
  goalId: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

/**
 * Final Goal card — dark default, or bright per-goal Granim mesh when verified.
 */
export function FinalGoalMeshCard({
  children,
  active = false,
  goalId,
  className,
  onClick,
  title,
}: FinalGoalMeshCardProps) {
  const palette = getGoalMeshPalette(goalId);

  const sharedProps = {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    title,
    className: cn(
      "group relative z-10 w-[168px] shrink-0 overflow-hidden rounded-xl text-left sm:w-[190px]",
      active
        ? "goal-mesh-pulse-border goal-mesh-pulse-border--completed"
        : "border-2 border-emerald-500/40 bg-[#0B1120] shadow-[0_0_16px_rgba(34,211,238,0.12)] transition-colors hover:border-emerald-400/70",
      onClick && "cursor-pointer",
      className,
    ),
  };

  const inner = active ? (
    <>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <GranimMeshBackground palette={palette} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-white/20 backdrop-blur-[8px]"
        style={{
          boxShadow: `inset 0 0 0 1px rgba(${rgbString(palette.colors[0]!)}, 0.28)`,
        }}
      />
      <div className="relative z-10 p-3 text-[#0f172a]">{children}</div>
    </>
  ) : (
    <div className="relative z-10 p-3">{children}</div>
  );

  if (onClick) {
    return (
      <motion.button type="button" onClick={onClick} {...sharedProps}>
        {inner}
      </motion.button>
    );
  }

  return <motion.div {...sharedProps}>{inner}</motion.div>;
}
