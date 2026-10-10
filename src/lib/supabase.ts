import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthStorage } from "@/lib/auth-storage";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseEnvConfigured,
} from "@/lib/supabase-env";

export const isSupabaseConfigured = isSupabaseEnvConfigured();

let client: SupabaseClient | null = null;

/** Custom fetch that avoids cached health-check responses and surfaces network failures clearly. */
function createAuthFetch(): typeof fetch {
  return (input, init) =>
    fetch(input, {
      ...init,
      cache: init?.cache ?? "no-store",
      credentials: init?.credentials ?? "omit",
    });
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    const { adapter: authStorage } = resolveAuthStorage();

    client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: authStorage,
        storageKey: "pivoton-supabase-auth",
      },
      global: {
        fetch: createAuthFetch(),
      },
    });
  }
  return client;
}

/** Dispose Supabase auth listeners — call on provider unmount (React Strict Mode). */
export function disposeSupabaseAuth(): void {
  if (!client) return;
  try {
    void client.auth.dispose();
  } catch {
    // Older SDK versions may not expose dispose().
  }
  client = null;
}

let authReachabilityCache: { ok: boolean; checkedAt: number } | null = null;
const AUTH_REACHABILITY_TTL_MS = 30_000;

/**
 * Advisory health probe — never use this to skip a real sign-in attempt.
 * Firefox may block or cache cross-origin probes differently than token requests.
 */
export async function isSupabaseAuthReachable(): Promise<boolean> {
  if (!isSupabaseConfigured || typeof window === "undefined") return false;

  const url = getSupabaseUrl().replace(/\/+$/, "");
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) return false;

  if (
    authReachabilityCache &&
    Date.now() - authReachabilityCache.checkedAt < AUTH_REACHABILITY_TTL_MS
  ) {
    return authReachabilityCache.ok;
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(`${url}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: getSupabaseAnonKey(),
        Accept: "application/json",
      },
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      signal: controller.signal,
    });

    window.clearTimeout(timeout);
    authReachabilityCache = { ok: response.ok, checkedAt: Date.now() };
    return response.ok;
  } catch {
    authReachabilityCache = { ok: false, checkedAt: Date.now() };
    return false;
  }
}

export function clearSupabaseReachabilityCache() {
  authReachabilityCache = null;
}
