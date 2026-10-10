import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WalletBalanceSnapshot } from "@/types/wallet";
import { buildWalletChartSeries } from "@/services/wallet-transactions";

type ChartRange = "1W" | "1M" | "1Y";

interface WalletBalanceChartProps {
  snapshots: WalletBalanceSnapshot[];
}

export function WalletBalanceChart({ snapshots }: WalletBalanceChartProps) {
  const [range, setRange] = useState<ChartRange>("1M");

  const series = useMemo(() => buildWalletChartSeries(snapshots, range), [range, snapshots]);

  const max = Math.max(...series.map((point) => point.totalValue), 1);
  const min = Math.min(...series.map((point) => point.totalValue), 0);
  const path = series
    .map((point, index) => {
      const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * 100;
      const y = 44 - ((point.totalValue - min) / (max - min || 1)) * 36;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Portfolio balance history</h3>
          <p className="text-xs text-muted-foreground">Available + reserved exposure over time</p>
        </div>
        <div className="inline-flex rounded-full border border-border/60 bg-[#0F172A] p-1">
          {(["1W", "1M", "1Y"] as ChartRange[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant="ghost"
              className={`h-7 rounded-full px-3 text-xs ${
                range === option ? "bg-[#1E293B] text-white hover:bg-[#1E293B]" : "text-slate-400"
              }`}
              onClick={() => setRange(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No balance history yet. Deposit or reserve funds to begin tracking.</p>
      ) : (
        <svg viewBox="0 0 100 48" className="mt-6 h-40 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="walletChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E599" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00E599" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L100,48 L0,48 Z`} fill="url(#walletChartFill)" />
          <path d={path} fill="none" stroke="#00E599" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}
