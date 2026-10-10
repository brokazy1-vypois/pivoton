import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUsd } from "@/lib/pivoton-erp";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";
import { WALLET_TRANSACTION_LABELS } from "@/types/wallet";

interface WalletTransactionTableProps {
  transactions: WalletTransaction[];
}

const STATUS_STYLES = {
  completed: "border-[#00E599]/40 bg-[#00E599]/10 text-[#00E599]",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
} as const;

export function WalletTransactionTable({ transactions }: WalletTransactionTableProps) {
  const [filter, setFilter] = useState<WalletTransactionType | "all">("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? transactions
        : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions],
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold">Transaction history</h3>
          <p className="text-xs text-muted-foreground">Deposits, withdrawals, reserves, and spending</p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as WalletTransactionType | "all")}>
          <SelectTrigger className="w-[200px] bg-[#0F172A]">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(WALLET_TRANSACTION_LABELS) as WalletTransactionType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {WALLET_TRANSACTION_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/60 bg-[#0F172A]/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              filtered.map((transaction) => (
                <tr key={transaction.id} className="border-b border-border/40 last:border-0">
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {WALLET_TRANSACTION_LABELS[transaction.type]}
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {transaction.type === "withdrawal" || transaction.type === "merchant_spend" || transaction.type === "reserve_freeze"
                      ? "−"
                      : "+"}
                    {formatUsd(transaction.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={STATUS_STYLES[transaction.status]}>{transaction.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {transaction.source}
                    {transaction.note ? (
                      <span className="mt-0.5 block text-xs">{transaction.note}</span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
