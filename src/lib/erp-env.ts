/** Demo key used when VITE_PIVOTON_ERP_API_KEY is unset — enables silent catalog fallback. */
export const DEFAULT_ERP_DEMO_API_KEY = "pivoton_demo_erp_key_2026";

export function getConfiguredErpApiKey(): string {
  return import.meta.env.VITE_PIVOTON_ERP_API_KEY?.trim() ?? "";
}

export function resolveErpApiKey(): string {
  return getConfiguredErpApiKey() || DEFAULT_ERP_DEMO_API_KEY;
}

export function isErpDemoApiKey(): boolean {
  return !getConfiguredErpApiKey();
}

export function getErpBaseUrl(): string {
  const ERP_ORIGIN = "https://pivoton-sync-flow.lovable.app";
  const DEFAULT_BASE_URL = `${ERP_ORIGIN}/api/v1/erp`;
  return import.meta.env.VITE_PIVOTON_ERP_BASE_URL?.trim() || DEFAULT_BASE_URL;
}
