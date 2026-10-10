import type { AchTransferSpeed, LinkedBankAccount } from "@/types/wallet";
import { US_BANK_OPTIONS } from "@/types/wallet";
import {
  getLinkedBankAccount,
  logWalletTransaction,
  recordWalletSnapshot,
  saveLinkedBankAccount,
} from "@/services/wallet-transactions";
import { depositWalletFunds, getUserBalance, withdrawWalletFunds } from "@/services/user-balances";

const INSTANT_FEE_RATE = 0.005;

export function calculateInstantTransferFee(amount: number): number {
  return Math.round(amount * INSTANT_FEE_RATE * 100) / 100;
}

export function calculateDepositNetAmount(amount: number, speed: AchTransferSpeed): number {
  if (speed === "instant") {
    return Math.round((amount - calculateInstantTransferFee(amount)) * 100) / 100;
  }
  return amount;
}

export async function simulatePlaidLinkBank(input: {
  userId: string;
  bankId: string;
}): Promise<LinkedBankAccount> {
  const bank = US_BANK_OPTIONS.find((option) => option.id === input.bankId);
  if (!bank) throw new Error("Select a supported US bank.");

  const account: LinkedBankAccount = {
    bankId: bank.id,
    bankName: bank.name,
    mask: String(Math.floor(1000 + Math.random() * 9000)),
    linkedAt: new Date().toISOString(),
  };

  saveLinkedBankAccount(input.userId, account);
  return account;
}

export async function processWalletDeposit(input: {
  userId: string;
  bankId: string;
  amount: number;
  speed: AchTransferSpeed;
}): Promise<{ netAmount: number; bankName: string }> {
  if (input.amount <= 0) throw new Error("Enter a valid deposit amount.");

  const bank = US_BANK_OPTIONS.find((option) => option.id === input.bankId);
  if (!bank) throw new Error("Select a supported US bank.");

  let linked = getLinkedBankAccount(input.userId);
  if (!linked || linked.bankId !== input.bankId) {
    linked = await simulatePlaidLinkBank({ userId: input.userId, bankId: input.bankId });
  }

  const netAmount = calculateDepositNetAmount(input.amount, input.speed);
  const balance = await depositWalletFunds(input.userId, netAmount);

  await logWalletTransaction({
    userId: input.userId,
    type: "deposit",
    amount: netAmount,
    source: linked.bankName,
    note:
      input.speed === "instant"
        ? `Instant RTP (${formatFeeNote(input.amount, netAmount)})`
        : "Standard ACH (1–3 days)",
  });

  await recordWalletSnapshot({
    userId: input.userId,
    available: balance.available_balance,
    reserved: balance.under_investment,
    cumulativeYield: balance.cumulative_yield,
  });

  return { netAmount, bankName: linked.bankName };
}

export async function processWalletWithdrawal(input: {
  userId: string;
  amount: number;
}): Promise<{ bankName: string }> {
  if (input.amount <= 0) throw new Error("Enter a valid withdrawal amount.");

  const linked = getLinkedBankAccount(input.userId);
  if (!linked) throw new Error("Link a US bank account before withdrawing.");

  const current = await getUserBalance(input.userId);
  if (input.amount > current.available_balance) {
    throw new Error("Withdrawal exceeds available spendable balance. Reserved funds cannot be withdrawn.");
  }

  const balance = await withdrawWalletFunds(input.userId, input.amount);

  await logWalletTransaction({
    userId: input.userId,
    type: "withdrawal",
    amount: input.amount,
    source: linked.bankName,
    note: "ACH payout to linked account",
  });

  await recordWalletSnapshot({
    userId: input.userId,
    available: balance.available_balance,
    reserved: balance.under_investment,
    cumulativeYield: balance.cumulative_yield,
  });

  return { bankName: linked.bankName };
}

function formatFeeNote(gross: number, net: number): string {
  const fee = Math.round((gross - net) * 100) / 100;
  return `$${fee.toFixed(2)} fee`;
}

export { getLinkedBankAccount, US_BANK_OPTIONS };
