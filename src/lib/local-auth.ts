import { readAuthStorageJson, writeAuthStorageJson } from "@/lib/auth-storage";
import type { AppUser } from "@/types/hope-post";

const LOCAL_CREDENTIALS_KEY = "pivoton-local-credentials";

interface LocalCredentialRecord {
  userId: string;
  email: string;
  password: string;
  fullName: string;
}

function readCredentialMap(): Record<string, LocalCredentialRecord> {
  return readAuthStorageJson<Record<string, LocalCredentialRecord>>(LOCAL_CREDENTIALS_KEY) ?? {};
}

function writeCredentialMap(map: Record<string, LocalCredentialRecord>) {
  writeAuthStorageJson(LOCAL_CREDENTIALS_KEY, map);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function createLocalUserId(email: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${normalizeEmail(email).replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
}

/** Dev/local fallback when Supabase auth is unreachable or not configured. */
export function registerLocalUser(
  email: string,
  password: string,
  fullName: string,
): AppUser {
  const normalizedEmail = normalizeEmail(email);
  const map = readCredentialMap();

  if (map[normalizedEmail]) {
    throw new Error("An account with this email already exists. Try signing in instead.");
  }

  const user: AppUser = {
    id: createLocalUserId(normalizedEmail),
    email: normalizedEmail,
    fullName: fullName.trim() || normalizedEmail.split("@")[0] || "Member",
    avatar: initials(fullName.trim() || normalizedEmail),
    role: "Member",
  };

  map[normalizedEmail] = {
    userId: user.id,
    email: normalizedEmail,
    password,
    fullName: user.fullName,
  };
  writeCredentialMap(map);
  return user;
}

export function signInLocalUser(email: string, password: string): AppUser | null {
  const normalizedEmail = normalizeEmail(email);
  const record = readCredentialMap()[normalizedEmail];
  if (!record || record.password !== password) return null;

  return {
    id: record.userId,
    email: record.email,
    fullName: record.fullName,
    avatar: initials(record.fullName),
    role: "Member",
  };
}
