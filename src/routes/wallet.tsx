import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Lock, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletBalanceChart } from "@/components/wallet/WalletBalanceChart";
import { WalletDepositModal } from "@/components/wallet/WalletDepositModal";
import { WalletTransactionTable } from "@/components/wallet/WalletTransactionTable";
import { WalletWithdrawModal } from "@/components/wallet/WalletWithdrawModal";
import { useAuth } from "@/context/AuthContext";
import { useUserBalance } from "@/context/UserBalanceContext";
import { formatUsd } from "@/lib/pivoton-erp";
import { computePortfolioTotal } from "@/types/shop-commerce";
import { listInvestmentHoldings } from "@/services/investment-holdings";
import { listWalletSnapshots, listWalletTransactions } from "@/services/wallet-transactions";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Investment Wallet — Pivoton Portfolio Ledger" },
      {
        name: "description",
        content:
          "Deposit and withdraw via Plaid ACH, track reserved Guaranteed Deal exposure, and review your Pivoton wallet transaction history.",
      },
      { property: "og:title", content: "Pivoton Investment Wallet" },
      {
        property: "og:description",
        content: "Portfolio ledger, banking actions, and transaction history for your Pivoton wallet.",
      },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user, openAuthModal } = useAuth();
  const { balance, refreshBalance, isLoading } = useUserBalance();
  const queryClient = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const transactionsQuery = useQuery({
    queryKey: ["wallet-transactions", user?.id],
    queryFn: () => listWalletTransactions(user!.id),
    enabled: Boolean(user?.id),
  });

  const snapshotsQuery = useQuery({
    queryKey: ["wallet-snapshots", user?.id],
    queryFn: () => listWalletSnapshots(user!.id),
    enabled: Boolean(user?.id),
  });

  const holdingsQuery = useQuery({
    queryKey: ["investment-holdings", user?.id],
    queryFn: () => listInvestmentHoldings(user!.id),
    enabled: Boolean(user?.id),
  });

  const available = balance?.available_balance ?? 0;
  const reserved = balance?.under_investment ?? 0;
  const cumulativeYield = balance?.cumulative_yield ?? 0;
  const portfolioTotal = computePortfolioTotal({
    available_balance: available,
    under_investment: reserved,
    cumulative_yield: cumulativeYield,
  });

  const allocation = useMemo(() => {
    const cash = available;
    const deals = reserved;
    const total = cash + deals || 1;
    return {
      cashPct: Math.round((cash / total) * 100),
      dealsPct: Math.round((deals / total) * 100),
    };
  }, [available, reserved]);

  const refreshWallet = async () => {
    await refreshBalance();
    if (!user?.id) return;
    await queryClient.invalidateQueries({ queryKey: ["wallet-transactions", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["wallet-snapshots", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["investment-holdings", user.id] });
  };

  const requireAuth = (action: () => void) => {
    if (!user) {
      openAuthModal("Sign in to access your Pivoton wallet");
      return;
    }
    action();
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#00E599]">Portfolio ledger</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Investment Wallet</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Manage spendable cash, frozen Guaranteed Deal reserves, and ACH banking flows synced with
            Marketplace and Trading Gateways.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
            onClick={() => requireAuth(() => setDepositOpen(true))}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Deposit Funds
          </Button>
          <Button variant="outline" onClick={() => requireAuth(() => setWithdrawOpen(true))}>
            <ArrowUpFromLine className="mr-2 h-4 w-4" /> Withdraw Cash
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Portfolio Value"
          value={formatUsd(portfolioTotal)}
          icon={<WalletIcon className="h-4 w-4 text-[#00E599]" />}
          loading={isLoading}
        />
        <SummaryCard
          label="Available Spendable Balance"
          value={formatUsd(available)}
          icon={<TrendingUp className="h-4 w-4 text-[#00E599]" />}
          loading={isLoading}
          hint="Ready for shopping, withdrawal, or new reserves"
        />
        <SummaryCard
          label="Active Reserved Balance"
          value={formatUsd(reserved)}
          icon={<Lock className="h-4 w-4 text-[#00E599]" />}
          loading={isLoading}
          hint={`${holdingsQuery.data?.length ?? 0} locked Guaranteed Deal position(s)`}
        />
        <SummaryCard
          label="Cumulative Yield / Earned Returns"
          value={formatUsd(cumulativeYield)}
          icon={<TrendingUp className="h-4 w-4 text-gold" />}
          loading={isLoading}
          hint="Tracked profits from investment positions"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <WalletBalanceChart snapshots={snapshotsQuery.data ?? []} />

        <div className="panel p-6">
          <h3 className="text-sm font-semibold">Asset allocation</h3>
          <p className="mt-1 text-xs text-muted-foreground">Cash vs. Guaranteed Deals exposure</p>

          <div className="mt-6 space-y-4">
            <AllocationRow label="Spendable cash" amount={available} percent={allocation.cashPct} tone="bg-[#00E599]" />
            <AllocationRow label="Guaranteed Deals reserves" amount={reserved} percent={allocation.dealsPct} tone="bg-primary" />
          </div>

          <div className="mt-6 flex h-2.5 overflow-hidden rounded-full">
            <span className="bg-[#00E599]" style={{ width: `${allocation.cashPct}%` }} />
            <span className="bg-primary" style={{ width: `${allocation.dealsPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <WalletTransactionTable transactions={transactionsQuery.data ?? []} />
      </div>

      {user && (
        <>
          <WalletDepositModal
            open={depositOpen}
            userId={user.id}
            onOpenChange={setDepositOpen}
            onComplete={refreshWallet}
          />
          <WalletWithdrawModal
            open={withdrawOpen}
            userId={user.id}
            availableBalance={available}
            onOpenChange={setWithdrawOpen}
            onComplete={refreshWallet}
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  hint,
  loading,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-4 font-display text-2xl font-semibold">
        {loading ? "—" : value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AllocationRow({
  label,
  amount,
  percent,
  tone,
}: {
  label: string;
  amount: number;
  percent: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatUsd(amount)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <span className={`block h-full ${tone}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="w-10 text-right text-xs text-muted-foreground">{percent}%</span>
      </div>
    </div>
  );
}
