import { useCallback, useRef, useState, type ReactNode } from "react";
import { LiquidGlassRippleOverlay } from "@/components/ui/liquid-glass/LiquidGlassRippleOverlay";
import {
  LiquidGlassRippleContext,
  type LiquidGlassRippleRequest,
} from "@/components/ui/liquid-glass/useLiquidGlassRipple";

interface LiquidGlassTransitionLayoutProps {
  children: ReactNode;
  appRootId?: string;
}

export function LiquidGlassTransitionLayout({
  children,
  appRootId = "app-root",
}: LiquidGlassTransitionLayoutProps) {
  const [ripple, setRipple] = useState<LiquidGlassRippleRequest | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  const triggerRipple = useCallback((request: LiquidGlassRippleRequest) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setRipple(request);
  }, []);

  const handleFinished = useCallback(() => {
    isTransitioningRef.current = false;
    setRipple(null);
    setIsTransitioning(false);
  }, []);

  return (
    <LiquidGlassRippleContext.Provider value={{ isTransitioning, triggerRipple }}>
      <div data-liquid-glass-root={appRootId}>{children}</div>
      <LiquidGlassRippleOverlay ripple={ripple} onFinished={handleFinished} />
    </LiquidGlassRippleContext.Provider>
  );
}
