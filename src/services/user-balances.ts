import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { logWalletTransaction, recordWalletSnapshot } from "@/services/wallet-transactions";
import {
  DEFAULT_SPENT_VIA_POS,
  DEFAULT_UNDER_INVESTMENT,
  computeAvailableBalance,
  type UserBalance,
} from "@/types/shop-commerce";

const LOCAL_BALANCE_PREFIX = "pivoton-user-balance";

function localKey(userId: string): string {
  return `${LOCAL_BALANCE_PREFIX}_${userId}`;
}

function readLocalBalance(userId: string): UserBalance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? (JSON.parse(raw) as UserBalance) : null;
  } catch {
    return null;
  }
}

function writeLocalBalance(balance: UserBalance) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localKey(balance.user_id), JSON.stringify(balance));
}

function normalizeRow(row: Record<string, unknown>): UserBalance {
  return {
    user_id: String(row.user_id),
    monthly_salary: Number(row.monthly_salary ?? 0),
    disbursed_loan_balance: Number(row.disbursed_loan_balance ?? 0),
    spent_via_pos: Number(row.spent_via_pos ?? 0),
    under_investment: Number(row.under_investment ?? 0),
    wallet_cash: Number(row.wallet_cash ?? 0),
    cumulative_yield: Number(row.cumulative_yield ?? 0),
    available_balance: Number(row.available_balance ?? 0),
    labor_contract_verified: Boolean(row.labor_contract_verified),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function getUserBalance(userId: string): Promise<UserBalance> {
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("user_balances")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) return normalizeRow(data as Record<string, unknown>);
  }

  return (
    readLocalBalance(userId) ?? {
      user_id: userId,
      monthly_salary: 0,
      disbursed_loan_balance: 0,
      spent_via_pos: 0,
      under_investment: 0,
      wallet_cash: 0,
      cumulative_yield: 0,
      available_balance: 0,
      labor_contract_verified: false,
    }
  );
}

function balanceInputs(balance: UserBalance) {
  return {
    disbursed_loan_balance: balance.disbursed_loan_balance,
    spent_via_pos: balance.spent_via_pos,
    under_investment: balance.under_investment,
    wallet_cash: balance.wallet_cash,
  };
}

async function syncWalletSnapshot(userId: string, balance: UserBalance) {
  await recordWalletSnapshot({
    userId,
    available: balance.available_balance,
    reserved: balance.under_investment,
    cumulativeYield: balance.cumulative_yield,
  });
}

export async function upsertUserBalance(balance: UserBalance): Promise<UserBalance> {
  const payload = {
    ...balance,
    available_balance: computeAvailableBalance(balanceInputs(balance)),
    updated_at: new Date().toISOString(),
  };

  writeLocalBalance(payload);

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("user_balances")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (!error && data) return normalizeRow(data as Record<string, unknown>);
  }

  return payload;
}

export async function applySalaryVerification(
  userId: string,
  monthlySalary: number,
): Promise<UserBalance> {
  const spent_via_pos = DEFAULT_SPENT_VIA_POS;
  const under_investment = DEFAULT_UNDER_INVESTMENT;
  const disbursed_loan_balance = monthlySalary;

  return upsertUserBalance({
    user_id: userId,
    monthly_salary: monthlySalary,
    disbursed_loan_balance,
    spent_via_pos,
    under_investment,
    available_balance: computeAvailableBalance({
      disbursed_loan_balance,
      spent_via_pos,
      under_investment,
      wallet_cash: 0,
    }),
    wallet_cash: 0,
    cumulative_yield: 0,
    labor_contract_verified: true,
  });
}

export async function deductForPurchase(
  userId: string,
  amount: number,
): Promise<UserBalance> {
  const current = await getUserBalance(userId);
  if (current.available_balance < amount) {
    throw new Error("Insufficient available balance for this purchase.");
  }

  const spent_via_pos = Math.round((current.spent_via_pos + amount) * 100) / 100;
  const next = await upsertUserBalance({
    ...current,
    spent_via_pos,
    available_balance: computeAvailableBalance({
      ...balanceInputs(current),
      spent_via_pos,
    }),
  });

  await logWalletTransaction({
    userId,
    type: "merchant_spend",
    amount,
    source: "Pivoton Shopping",
    note: "Affiliate marketplace purchase",
  });
  await syncWalletSnapshot(userId, next);
  return next;
}

export async function refundPurchase(userId: string, amount: number): Promise<UserBalance> {
  const current = await getUserBalance(userId);
  const spent_via_pos = Math.max(0, Math.round((current.spent_via_pos - amount) * 100) / 100);

  return upsertUserBalance({
    ...current,
    spent_via_pos,
    available_balance: computeAvailableBalance({
      ...balanceInputs(current),
      spent_via_pos,
    }),
  });
}

export async function reserveForInvestment(
  userId: string,
  amount: number,
): Promise<UserBalance> {
  const current = await getUserBalance(userId);
  if (current.available_balance < amount) {
    throw new Error("Insufficient available balance for this reservation.");
  }

  const under_investment = Math.round((current.under_investment + amount) * 100) / 100;
  const next = await upsertUserBalance({
    ...current,
    under_investment,
    available_balance: computeAvailableBalance({
      ...balanceInputs(current),
      under_investment,
    }),
  });

  await logWalletTransaction({
    userId,
    type: "reserve_freeze",
    amount,
    source: "Guaranteed Deals",
    note: "Marketplace reserve lock",
  });
  await syncWalletSnapshot(userId, next);
  return next;
}

/** Return frozen reserve funds to available balance when a gateway is disconnected. */
export async function releaseReserveForInvestment(
  userId: string,
  amount: number,
): Promise<UserBalance> {
  if (amount <= 0) return getUserBalance(userId);

  const current = await getUserBalance(userId);
  const under_investment = Math.max(
    0,
    Math.round((current.under_investment - amount) * 100) / 100,
  );

  const next = await upsertUserBalance({
    ...current,
    under_investment,
    available_balance: computeAvailableBalance({
      ...balanceInputs(current),
      under_investment,
    }),
  });

  await logWalletTransaction({
    userId,
    type: "reserve_refund",
    amount,
    source: "Trading Gateway",
    note: "Reserve released to available balance",
  });
  await syncWalletSnapshot(userId, next);
  return next;
}

export async function depositWalletFunds(userId: string, amount: number): Promise<UserBalance> {
  const current = await getUserBalance(userId);
  const wallet_cash = Math.round((current.wallet_cash + amount) * 100) / 100;

  return upsertUserBalance({
    ...current,
    wallet_cash,
    available_balance: computeAvailableBalance({
      ...balanceInputs(current),
      wallet_cash,
    }),
  });
}

export async function withdrawWalletFunds(userId: string, amount: number): Promise<UserBalance> {
  const current = await getUserBalance(userId);
  if (current.available_balance < amount) {
    throw new Error("Insufficient available balance for withdrawal.");
  }

  let remaining = amount;
  let wallet_cash = current.wallet_cash;
  let disbursed_loan_balance = current.disbursed_loan_balance;

  const fromWalletCash = Math.min(wallet_cash, remaining);
  wallet_cash = Math.round((wallet_cash - fromWalletCash) * 100) / 100;
  remaining = Math.round((remaining - fromWalletCash) * 100) / 100;

  if (remaining > 0) {
    disbursed_loan_balance = Math.max(
      0,
      Math.round((disbursed_loan_balance - remaining) * 100) / 100,
    );
  }

  return upsertUserBalance({
    ...current,
    wallet_cash,
    disbursed_loan_balance,
    available_balance: computeAvailableBalance({
      disbursed_loan_balance,
      spent_via_pos: current.spent_via_pos,
      under_investment: current.under_investment,
      wallet_cash,
    }),
  });
}
