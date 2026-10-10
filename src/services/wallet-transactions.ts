import type {
  LinkedBankAccount,
  WalletBalanceSnapshot,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from "@/types/wallet";

const TX_PREFIX = "pivoton-wallet-tx";
const BANK_PREFIX = "pivoton-linked-bank";
const SNAPSHOT_PREFIX = "pivoton-wallet-snapshots";

function txKey(userId: string): string {
  return `${TX_PREFIX}_${userId}`;
}

function bankKey(userId: string): string {
  return `${BANK_PREFIX}_${userId}`;
}

function snapshotKey(userId: string): string {
  return `${SNAPSHOT_PREFIX}_${userId}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export async function listWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  return readJson<WalletTransaction[]>(txKey(userId), []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function addWalletTransaction(
  tx: Omit<WalletTransaction, "id"> & { id?: string },
): Promise<WalletTransaction> {
  const record: WalletTransaction = {
    id: tx.id ?? crypto.randomUUID(),
    ...tx,
  };
  const current = readJson<WalletTransaction[]>(txKey(record.userId), []);
  writeJson(txKey(record.userId), [record, ...current]);
  return record;
}

export async function logWalletTransaction(input: {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  source: string;
  status?: WalletTransactionStatus;
  note?: string;
}): Promise<WalletTransaction> {
  return addWalletTransaction({
    userId: input.userId,
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    status: input.status ?? "completed",
    source: input.source,
    createdAt: new Date().toISOString(),
    note: input.note,
  });
}

export function getLinkedBankAccount(userId: string): LinkedBankAccount | null {
  return readJson<LinkedBankAccount | null>(bankKey(userId), null);
}

export function saveLinkedBankAccount(userId: string, account: LinkedBankAccount): void {
  writeJson(bankKey(userId), account);
}

export async function listWalletSnapshots(userId: string): Promise<WalletBalanceSnapshot[]> {
  return readJson<WalletBalanceSnapshot[]>(snapshotKey(userId), []).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export async function appendWalletSnapshot(
  userId: string,
  snapshot: WalletBalanceSnapshot,
): Promise<void> {
  const current = await listWalletSnapshots(userId);
  writeJson(snapshotKey(userId), [...current, snapshot]);
}

export async function recordWalletSnapshot(input: {
  userId: string;
  available: number;
  reserved: number;
  cumulativeYield: number;
}): Promise<void> {
  await appendWalletSnapshot(input.userId, {
    date: new Date().toISOString(),
    available: input.available,
    reserved: input.reserved,
    totalValue: Math.round((input.available + input.reserved + input.cumulativeYield) * 100) / 100,
  });
}

/** Build chart series from snapshots, padded with synthetic history when sparse. */
export function buildWalletChartSeries(
  snapshots: WalletBalanceSnapshot[],
  range: "1W" | "1M" | "1Y",
): WalletBalanceSnapshot[] {
  const now = Date.now();
  const ms =
    range === "1W" ? 7 * 86400000 : range === "1M" ? 30 * 86400000 : 365 * 86400000;
  const cutoff = now - ms;
  const filtered = snapshots.filter((point) => new Date(point.date).getTime() >= cutoff);

  if (filtered.length >= 2) return filtered;

  const latest = snapshots.at(-1) ?? filtered.at(-1);
  if (!latest) return [];

  const points = range === "1W" ? 7 : range === "1M" ? 10 : 12;
  const step = ms / Math.max(1, points - 1);
  return Array.from({ length: points }, (_, index) => {
    const date = new Date(cutoff + step * index).toISOString();
    const drift = 0.92 + (index / points) * 0.08;
    return {
      date,
      totalValue: Math.round(latest.totalValue * drift * 100) / 100,
      available: Math.round(latest.available * drift * 100) / 100,
      reserved: Math.round(latest.reserved * drift * 100) / 100,
    };
  });
}
