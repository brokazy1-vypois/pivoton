import { getAuthStorageBackend } from "@/lib/auth-storage";

export function isAuthStorageError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "SecurityError" || error.name === "QuotaExceededError";
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const lower = message.toLowerCase();
  return (
    lower.includes("securityerror") ||
    lower.includes("quotaexceeded") ||
    lower.includes("storage") ||
    lower.includes("localstorage") ||
    lower.includes("sessionstorage")
  );
}

export function isAuthNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("load failed") ||
      message.includes("networkerror when attempting to fetch")
    );
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name: unknown }).name);
    if (name === "AuthRetryableFetchError") return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("could not resolve host") ||
    lower.includes("cors") ||
    lower.includes("aborted")
  );
}

function storageHint(): string {
  const backend = getAuthStorageBackend();
  if (backend === "memory") {
    return " Your browser blocked persistent storage — try disabling Enhanced Tracking Protection for this site or allow cookies/storage.";
  }
  if (backend === "sessionStorage") {
    return " Session storage is being used because localStorage is blocked in this browser.";
  }
  return "";
}

export function formatAuthError(error: unknown, fallback: string): string {
  if (isAuthStorageError(error)) {
    return `Browser storage is restricted and the session could not be saved.${storageHint()}`;
  }

  if (isAuthNetworkError(error)) {
    return `Cannot reach the authentication server. Check your connection and Supabase settings, or use Quick demo login.${storageHint()}`;
  }

  if (error instanceof Error && error.message.trim()) {
    const lower = error.message.toLowerCase();
    if (lower.includes("invalid login credentials")) {
      return "Invalid email or password.";
    }
    if (lower.includes("email not confirmed")) {
      return "Please confirm your email before signing in.";
    }
    return error.message;
  }

  return fallback;
}
