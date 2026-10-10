import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  AI_FINANCE_FREE_DAILY_LIMIT,
  canSendAiFinancePrompt,
  getAiFinancePromptCount,
  getAiFinanceRemainingPrompts,
  getLocalDateKey,
  incrementAiFinancePromptCount,
} from "@/lib/ai-finance-usage";

export function useAiFinanceUsage() {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const isPremium = user?.isPremium ?? false;

  const [dateKey, setDateKey] = useState(getLocalDateKey);
  const [count, setCount] = useState(() => getAiFinancePromptCount(userId));

  useEffect(() => {
    setCount(getAiFinancePromptCount(userId));
  }, [userId, dateKey]);

  // Reset counter display when the local calendar day changes
  useEffect(() => {
    const tick = () => {
      const next = getLocalDateKey();
      setDateKey((prev) => (prev === next ? prev : next));
    };

    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = getAiFinanceRemainingPrompts(userId, isPremium);
  const limitReached = !isPremium && !canSendAiFinancePrompt(userId, isPremium);

  const recordSuccessfulPrompt = useCallback(() => {
    if (isPremium) return;
    const next = incrementAiFinancePromptCount(userId);
    setCount(next);
  }, [userId, isPremium]);

  return {
    userId,
    isPremium,
    count,
    remaining,
    dailyLimit: AI_FINANCE_FREE_DAILY_LIMIT,
    limitReached,
    recordSuccessfulPrompt,
  };
}
