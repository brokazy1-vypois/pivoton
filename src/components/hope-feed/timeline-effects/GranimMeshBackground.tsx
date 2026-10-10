import { useEffect, useRef } from "react";
import Granim from "granim";
import { cn } from "@/lib/utils";
import { paletteToGranimGradients, type GoalMeshPalette } from "@/lib/goal-mesh-palettes";

interface GranimMeshBackgroundProps {
  palette: GoalMeshPalette;
  className?: string;
}

/** Fluid mesh gradient via Granim.js */
export function GranimMeshBackground({ palette, className }: GranimMeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const granimRef = useRef<Granim | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gradients = paletteToGranimGradients(palette);

    granimRef.current = new Granim({
      element: canvas,
      direction: "diagonal",
      isPausedWhenNotInView: true,
      defaultStateName: "goal-mesh",
      states: {
        "goal-mesh": {
          gradients,
          transitionSpeed: 2800,
          loop: true,
        },
      },
    });

    return () => {
      granimRef.current?.destroy();
      granimRef.current = null;
    };
  }, [palette]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
