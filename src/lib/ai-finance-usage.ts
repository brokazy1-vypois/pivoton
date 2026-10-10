export const AI_FINANCE_FREE_DAILY_LIMIT = 3;

/** Local calendar date key (resets at local midnight). */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function aiFinancePromptStorageKey(userId: string, dateKey = getLocalDateKey()): string {
  return `ai_finance_prompts_count_${userId}_${dateKey}`;
}

export function getAiFinancePromptCount(userId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(aiFinancePromptStorageKey(userId));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function incrementAiFinancePromptCount(userId: string): number {
  const next = getAiFinancePromptCount(userId) + 1;
  if (typeof window !== "undefined") {
    localStorage.setItem(aiFinancePromptStorageKey(userId), String(next));
  }
  return next;
}

export function getAiFinanceRemainingPrompts(
  userId: string,
  isPremium: boolean,
): number | null {
  if (isPremium) return null;
  return Math.max(0, AI_FINANCE_FREE_DAILY_LIMIT - getAiFinancePromptCount(userId));
}

export function canSendAiFinancePrompt(userId: string, isPremium: boolean): boolean {
  if (isPremium) return true;
  return getAiFinancePromptCount(userId) < AI_FINANCE_FREE_DAILY_LIMIT;
}
