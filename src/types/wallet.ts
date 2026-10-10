export type WalletTransactionType =
  | "deposit"
  | "withdrawal"
  | "reserve_freeze"
  | "reserve_refund"
  | "merchant_spend"
  | "yield";

export type WalletTransactionStatus = "completed" | "pending" | "failed";

export type AchTransferSpeed = "standard" | "instant";

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  /** Bank name, gateway, or merchant source label. */
  source: string;
  createdAt: string;
  note?: string;
}

export interface LinkedBankAccount {
  bankId: string;
  bankName: string;
  mask: string;
  linkedAt: string;
}

export interface WalletBalanceSnapshot {
  date: string;
  totalValue: number;
  available: number;
  reserved: number;
}

export interface UsBankOption {
  id: string;
  name: string;
  accent: string;
}

export const US_BANK_OPTIONS: UsBankOption[] = [
  { id: "chase", name: "Chase", accent: "#117ACA" },
  { id: "bofa", name: "Bank of America", accent: "#E31837" },
  { id: "wells", name: "Wells Fargo", accent: "#D71E28" },
  { id: "citi", name: "Citi", accent: "#003B70" },
  { id: "capital-one", name: "Capital One", accent: "#004977" },
];

export const WALLET_TRANSACTION_LABELS: Record<WalletTransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  reserve_freeze: "Reserve Freeze",
  reserve_refund: "Reserve Refund",
  merchant_spend: "Merchant Spend",
  yield: "Earned Returns",
};
