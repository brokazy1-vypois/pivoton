import type { AiPurchaseEstimate } from "@/types/signal-feed";
import { normalizeTicker } from "@/lib/mock-market-prices";

const WINDOWS = [
  {
    windowLabel: "~2 hours",
    detail: "Expected entry zone reached within ~2 hours based on intraday volatility bands.",
    confidence: "high" as const,
  },
  {
    windowLabel: "1 trading session",
    detail: "AI Estimate: Expected entry zone reached within 1 trading session — watch the 20-day VWAP support.",
    confidence: "medium" as const,
  },
  {
    windowLabel: "2–3 sessions",
    detail: "AI Estimate: Consolidation phase detected — entry window likely in 2–3 sessions pending volume confirmation.",
    confidence: "medium" as const,
  },
  {
    windowLabel: "~4 hours",
    detail: "AI Estimate: Momentum cooling — optimal entry zone expected within ~4 hours at current ATR levels.",
    confidence: "low" as const,
  },
];

export function getAiPurchaseEstimate(ticker: string): AiPurchaseEstimate {
  const key = normalizeTicker(ticker);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return WINDOWS[Math.abs(hash) % WINDOWS.length];
}
