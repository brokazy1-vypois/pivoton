import { getApiById, IDEATION_API_CATALOG } from "@/data/ideation-api-catalog";

export const ENV_STORAGE_KEY = "pivoton-ideation-env";
export const CONNECTED_STORAGE_KEY = "pivoton-ideation-connected";

export function loadEnvVars(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ENV_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function persistEnvVars(vars: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(vars));
}

export function loadConnectedApiIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONNECTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => getApiById(id)) : [];
  } catch {
    return [];
  }
}

export function persistConnectedApiIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONNECTED_STORAGE_KEY, JSON.stringify(ids));
}

export function isApiFullyConfigured(apiId: string, envVars: Record<string, string>): boolean {
  const api = getApiById(apiId);
  if (!api) return false;
  return api.envVars.every((envVar) => envVars[envVar.key]?.trim());
}

export function getConfiguredApiIds(envVars: Record<string, string>): string[] {
  return IDEATION_API_CATALOG.filter((api) => isApiFullyConfigured(api.id, envVars)).map(
    (api) => api.id,
  );
}

export function syncConnectedApiIds(
  connectedApiIds: string[],
  envVars: Record<string, string>,
): string[] {
  return connectedApiIds.filter((apiId) => isApiFullyConfigured(apiId, envVars));
}
