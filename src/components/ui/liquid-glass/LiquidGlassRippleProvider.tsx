import { type ReactNode } from "react";
import { LiquidGlassTransitionLayout } from "@/components/ui/liquid-glass/LiquidGlassTransitionLayout";

/** @deprecated Use `LiquidGlassTransitionLayout` — kept for backward compatibility. */
export function LiquidGlassRippleProvider({ children }: { children: ReactNode }) {
  return <LiquidGlassTransitionLayout>{children}</LiquidGlassTransitionLayout>;
}
