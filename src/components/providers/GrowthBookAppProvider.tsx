import { GrowthBookProvider } from "@growthbook/growthbook-react";
import { useEffect, type ReactNode } from "react";
import { growthbook, isGrowthBookConfigured } from "@/lib/growthbook";

interface GrowthBookAppProviderProps {
  children: ReactNode;
}

export function GrowthBookAppProvider({ children }: GrowthBookAppProviderProps) {
  useEffect(() => {
    if (!isGrowthBookConfigured()) return;

    void growthbook.init({ streaming: true });

    return () => {
      growthbook.destroy();
    };
  }, []);

  if (!isGrowthBookConfigured()) {
    return children;
  }

  return <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>;
}
