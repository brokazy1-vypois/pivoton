const VOICE_USAGE_PREFIX = "pivoton-voice-broker-seconds";
export const VOICE_FREE_TRIAL_SECONDS = 60;

function storageKey(userId: string): string {
  return `${VOICE_USAGE_PREFIX}_${userId}`;
}

export function getVoiceSecondsUsed(userId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(storageKey(userId));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function addVoiceSecondsUsed(userId: string, seconds: number): number {
  if (typeof window === "undefined") return 0;
  const next = Math.round((getVoiceSecondsUsed(userId) + seconds) * 10) / 10;
  localStorage.setItem(storageKey(userId), String(next));
  return next;
}

export function getVoiceTrialRemaining(userId: string, isPremium: boolean): number | null {
  if (isPremium) return null;
  return Math.max(0, VOICE_FREE_TRIAL_SECONDS - getVoiceSecondsUsed(userId));
}

export function isVoiceTrialExpired(userId: string, isPremium: boolean): boolean {
  if (isPremium) return false;
  return getVoiceSecondsUsed(userId) >= VOICE_FREE_TRIAL_SECONDS;
}

export function formatVoiceTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
