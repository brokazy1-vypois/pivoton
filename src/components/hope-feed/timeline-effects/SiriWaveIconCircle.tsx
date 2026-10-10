import { useLayoutEffect, useRef } from "react";
import SiriWave from "siriwave";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

/** Siri sphere palette — magenta, cobalt, cyan, violet (reference image 2). */
const SPHERE_CURVES = [
  { color: "255,255,255", supportLine: true },
  { color: "236, 72, 153" },
  { color: "59, 130, 246" },
  { color: "34, 211, 238" },
  { color: "168, 85, 247" },
  { color: "244, 114, 182" },
] as const;

export interface SiriWaveIconCircleProps {
  /** All steps verified — show Siri wave sphere. */
  active?: boolean;
  size?: number;
  className?: string;
}

/**
 * Default: static green target icon.
 * Active (all steps verified): multicolor Siri wave sphere.
 */
export function SiriWaveIconCircle({
  active = false,
  size = 44,
  className,
}: SiriWaveIconCircleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const waveHostRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<SiriWave | null>(null);

  useLayoutEffect(() => {
    if (!active) return;

    const host = waveHostRef.current;
    const root = rootRef.current;
    if (!host || !root) return;

    let disposed = false;

    const initWave = () => {
      if (disposed || !host.isConnected) return;

      waveRef.current?.dispose();

      const wave = new SiriWave({
        container: host,
        style: "ios9",
        width: size,
        height: size,
        autostart: false,
        cover: true,
        speed: 0.16,
        amplitude: 2,
        ratio: Math.min(window.devicePixelRatio || 1, 2),
        globalCompositeOperation: "lighter",
        curveDefinition: [...SPHERE_CURVES],
      });

      waveRef.current = wave;
      wave.start();
    };

    initWave();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!waveRef.current) return;
        if (entry?.isIntersecting) waveRef.current.start();
        else waveRef.current.stop();
      },
      { threshold: 0.1, rootMargin: "48px" },
    );

    observer.observe(root);

    return () => {
      disposed = true;
      observer.disconnect();
      waveRef.current?.dispose();
      waveRef.current = null;
    };
  }, [active, size]);

  if (!active) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-[#0B1120] text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.2)]",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Target className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-[#0a1628] shadow-[0_0_32px_rgba(236,72,153,0.35),0_0_56px_rgba(34,211,238,0.22)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-8px] rounded-full bg-gradient-to-br from-fuchsia-500/40 via-blue-500/25 to-cyan-400/30 blur-lg"
      />
      <div
        ref={waveHostRef}
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-full opacity-95"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[15%] rounded-full bg-white/50 blur-lg"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[28%] rounded-full bg-white/80 blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_12px_rgba(15,23,42,0.55)]"
      />
    </div>
  );
}
