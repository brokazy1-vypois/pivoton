/**
 * Cross-browser auth storage with graceful degradation.
 * Firefox ETP / strict privacy can block localStorage writes while reads still work.
 * Passing raw localStorage to Supabase bypasses its internal writability probe — we fix that here.
 */

export interface AuthStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type AuthStorageBackend = "localStorage" | "sessionStorage" | "memory";

let cachedAdapter: AuthStorageAdapter | null = null;
let cachedBackend: AuthStorageBackend | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function testStorage(storage: Storage): boolean {
  if (!isBrowser()) return false;
  try {
    const probeKey = `pivoton-auth-probe-${Math.random().toString(36).slice(2)}`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function createMemoryAdapter(store: Record<string, string> = {}): AuthStorageAdapter {
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

/** Resolve the best writable storage backend for this browser/session. */
export function resolveAuthStorage(): { adapter: AuthStorageAdapter; backend: AuthStorageBackend } {
  if (cachedAdapter && cachedBackend) {
    return { adapter: cachedAdapter, backend: cachedBackend };
  }

  if (!isBrowser()) {
    cachedAdapter = createMemoryAdapter();
    cachedBackend = "memory";
    return { adapter: cachedAdapter, backend: cachedBackend };
  }

  if (testStorage(window.localStorage)) {
    cachedAdapter = window.localStorage;
    cachedBackend = "localStorage";
    return { adapter: cachedAdapter, backend: cachedBackend };
  }

  if (testStorage(window.sessionStorage)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Pivoton Auth] localStorage is blocked in this browser — falling back to sessionStorage.",
      );
    }
    cachedAdapter = window.sessionStorage;
    cachedBackend = "sessionStorage";
    return { adapter: cachedAdapter, backend: cachedBackend };
  }

  if (import.meta.env.DEV) {
    console.warn(
      "[Pivoton Auth] Web storage is blocked — using in-memory session (will not survive reload).",
    );
  }

  cachedAdapter = createMemoryAdapter();
  cachedBackend = "memory";
  return { adapter: cachedAdapter, backend: cachedBackend };
}

export function getAuthStorageBackend(): AuthStorageBackend {
  return resolveAuthStorage().backend;
}

export function isAuthStoragePersisted(): boolean {
  return getAuthStorageBackend() !== "memory";
}

/** Read a raw string value from auth storage. */
export function readAuthStorageString(key: string): string | null {
  const { adapter } = resolveAuthStorage();
  try {
    return adapter.getItem(key);
  } catch {
    return null;
  }
}

/** Read JSON from auth storage with safe fallback. */
export function readAuthStorageJson<T>(key: string): T | null {
  const { adapter } = resolveAuthStorage();
  try {
    const raw = adapter.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write JSON to auth storage; returns false when storage is blocked. */
export function writeAuthStorageJson(key: string, value: unknown): boolean {
  const { adapter } = resolveAuthStorage();
  try {
    adapter.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[Pivoton Auth] Failed to persist auth data:", error);
    }
    return false;
  }
}

export function removeAuthStorageKey(key: string): void {
  const { adapter } = resolveAuthStorage();
  try {
    adapter.removeItem(key);
  } catch {
    // Best-effort cleanup.
  }
}

export function resetAuthStorageCacheForTests() {
  cachedAdapter = null;
  cachedBackend = null;
}
