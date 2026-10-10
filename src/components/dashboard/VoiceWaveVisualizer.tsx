import { cn } from "@/lib/utils";

interface VoiceWaveVisualizerProps {
  active: boolean;
  className?: string;
}

const BAR_HEIGHTS = [0.35, 0.65, 0.45, 0.85, 0.55, 0.75, 0.4, 0.9, 0.5, 0.7, 0.6, 0.8];

export function VoiceWaveVisualizer({ active, className }: VoiceWaveVisualizerProps) {
  return (
    <div
      className={cn(
        "flex h-14 items-end justify-center gap-1 rounded-lg border border-border bg-[#0B0E14] px-4 py-3",
        className,
      )}
      aria-hidden
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={cn(
            "w-1.5 rounded-full bg-emerald-500/80",
            active && "animate-[voice-bar_0.9s_ease-in-out_infinite]",
            !active && "h-2 opacity-30",
          )}
          style={
            active
              ? {
                  animationDelay: `${index * 0.07}s`,
                  height: `${Math.max(20, Math.round(height * 56))}px`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
