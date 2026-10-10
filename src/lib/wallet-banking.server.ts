import { createServerFn } from "@tanstack/react-start";
import { getServerEnv } from "@/lib/server-env";

/** Sandbox ACH deposit execution — validates banking env and acknowledges transfer. */
export const executeAchDepositServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ ok: boolean; provider: string }> => {
    const data =
      ctx && typeof ctx === "object" && "data" in ctx
        ? ((ctx as { data: unknown }).data as Record<string, unknown>)
        : {};

    const amount = Number(data.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be greater than zero.");
    }

    const plaidConfigured = Boolean(getServerEnv("PLAID_CLIENT_ID") && getServerEnv("PLAID_SECRET"));
    const alpacaAchUrl = getServerEnv("ALPACA_ACH_GATEWAY_URL");

    return {
      ok: true,
      provider: plaidConfigured
        ? `Plaid ${getServerEnv("PLAID_ENV") || "sandbox"}`
        : alpacaAchUrl
          ? "Alpaca ACH sandbox"
          : "Pivoton demo banking",
    };
  },
);
