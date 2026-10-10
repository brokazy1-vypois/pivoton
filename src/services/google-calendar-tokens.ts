import type { GoogleCalendarTokenRecord } from "@/types/hangout";

const TOKEN_PREFIX = "pivoton-google-calendar-oauth";

function storageKey(userId: string): string {
  return `${TOKEN_PREFIX}_${userId}`;
}

export function saveGoogleCalendarToken(record: GoogleCalendarTokenRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(record.userId), JSON.stringify(record));
}

export function getGoogleCalendarToken(userId: string): GoogleCalendarTokenRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as GoogleCalendarTokenRecord) : null;
  } catch {
    return null;
  }
}

export function removeGoogleCalendarToken(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(userId));
}

export function isGoogleCalendarTokenValid(record: GoogleCalendarTokenRecord | null): boolean {
  if (!record?.accessToken) return false;
  if (!record.expiresAt) return true;
  return new Date(record.expiresAt).getTime() > Date.now() + 60_000;
}
