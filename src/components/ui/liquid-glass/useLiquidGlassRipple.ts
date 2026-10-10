import { createContext, useContext } from "react";
import type { LiquidGlassVariant } from "@/components/ui/liquid-glass/liquid-glass-theme";

export interface LiquidGlassRippleRequest {
  x: number;
  y: number;
  variant: LiquidGlassVariant;
  destinationPath: string;
  onNavigate: () => void;
}

interface LiquidGlassRippleContextValue {
  isTransitioning: boolean;
  triggerRipple: (request: LiquidGlassRippleRequest) => void;
}

export const LiquidGlassRippleContext = createContext<LiquidGlassRippleContextValue | null>(null);

export function useLiquidGlassRipple() {
  const ctx = useContext(LiquidGlassRippleContext);
  if (!ctx) {
    throw new Error("useLiquidGlassRipple must be used within LiquidGlassRippleProvider");
  }
  return ctx;
}
