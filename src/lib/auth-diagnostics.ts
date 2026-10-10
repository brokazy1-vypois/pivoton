import { getAuthStorageBackend, isAuthStoragePersisted } from "@/lib/auth-storage";
import { getSupabaseUrl, isSupabaseEnvConfigured } from "@/lib/supabase-env";

export interface AuthDiagnosticsSnapshot {
  browser: string;
  supabaseConfigured: boolean;
  storageBackend: string;
  storagePersisted: boolean;
  isSecureContext: boolean;
  cookieEnabled: boolean;
  timestamp: string;
}

function detectBrowserLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return "unknown";
}

export function captureAuthDiagnostics(): AuthDiagnosticsSnapshot {
  return {
    browser: detectBrowserLabel(),
    supabaseConfigured: isSupabaseEnvConfigured(),
    storageBackend: getAuthStorageBackend(),
    storagePersisted: isAuthStoragePersisted(),
    isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    cookieEnabled: typeof navigator !== "undefined" ? navigator.cookieEnabled : false,
    timestamp: new Date().toISOString(),
  };
}

export function logAuthDiagnostics(context: string, extra?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  console.info(`[Pivoton Auth] ${context}`, {
    ...captureAuthDiagnostics(),
    supabaseHost: isSupabaseEnvConfigured() ? new URL(getSupabaseUrl()).host : null,
    ...extra,
  });
}
