import { cn } from "@/lib/utils";
import { ROBOT_SPLINE_IFRAME } from "@/lib/spline-robot";

export interface RobotSplineEmbedProps {
  className?: string;
  style?: React.CSSProperties;
  /** Vertical anchor within the frame (default matches dashboard). */
  top?: string;
  width?: string;
  height?: string;
  scale?: number;
  translateX?: number;
  translateY?: number;
}

/**
 * Native Spline iframe embed — same head-tracking path as the dashboard voice broker.
 * Keep filters/animations off the iframe so pointer tracking stays responsive.
 */
export function RobotSplineEmbed({
  className,
  style,
  top = "44%",
  width = "104%",
  height = "118%",
  scale = 0.86,
  translateX = 0,
  translateY = 0,
}: RobotSplineEmbedProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <iframe
        src={ROBOT_SPLINE_IFRAME}
        title="3D AI Broker"
        className={cn(
          "pointer-events-auto absolute left-1/2 border-0 bg-transparent",
          className,
        )}
        style={{
          top,
          width,
          height,
          transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: "center center",
          ...style,
        }}
        loading="eager"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
