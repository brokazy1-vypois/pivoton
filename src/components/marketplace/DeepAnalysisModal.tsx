import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Brain,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnalysisChartPanel } from "@/components/marketplace/AnalysisChartPanel";
import { fetchMarketAnalysisServer } from "@/lib/market-analysis.server";
import { formatUsd } from "@/lib/pivoton-erp";
import type { ChartViewMode, MarketplaceRumor } from "@/types/market-analysis";

interface DeepAnalysisModalProps {
  rumor: MarketplaceRumor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LiveIndicator({
  isFetching,
  updatedAt,
}: {
  isFetching: boolean;
  updatedAt?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {isFetching ? (
          <Loader2 className="h-2 w-2 animate-spin text-primary" />
        ) : (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </>
        )}
      </span>
      <span>{isFetching ? "Updating live data…" : "Live"}</span>
      {updatedAt ? (
        <span className="hidden sm:inline">· {new Date(updatedAt).toLocaleTimeString()}</span>
      ) : null}
    </div>
  );
}

function AnalysisSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-[#0B0E14] p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        {title}
      </h3>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function DeepAnalysisModal({ rumor, open, onOpenChange }: DeepAnalysisModalProps) {
  const [chartMode, setChartMode] = useState<ChartViewMode>("candlestick");
  const refCode = rumor?.id;

  const analysisQuery = useQuery({
    queryKey: ["market-analysis", refCode],
    queryFn: () => fetchMarketAnalysisServer({ data: refCode! }),
    enabled: open && Boolean(refCode),
    staleTime: 45_000,
    refetchInterval: open ? 60_000 : false,
    retry: 1,
  });

  const data = analysisQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto border-border bg-[#121824] p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader className="space-y-3 pr-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-lg sm:text-xl">
                <Brain className="h-5 w-5 text-primary" />
                Anonymized Deep Financial Intelligence
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                Asset ID: <span className="font-mono text-foreground">{refCode ?? "—"}</span>
                {rumor ? ` · ${rumor.sector} · ${rumor.index}` : ""}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <LiveIndicator
                isFetching={analysisQuery.isFetching}
                updatedAt={analysisQuery.dataUpdatedAt}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-border bg-[#0B0E14] text-xs"
                onClick={() => analysisQuery.refetch()}
                disabled={analysisQuery.isFetching}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${analysisQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </DialogHeader>

        {analysisQuery.isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Fetching live market data & generating anonymized analysis…
          </div>
        )}

        {analysisQuery.isError && (
          <div className="rounded-lg border border-bear/30 bg-bear/10 p-4 text-sm text-bear">
            {analysisQuery.error instanceof Error
              ? analysisQuery.error.message
              : "Could not load market analysis."}
          </div>
        )}

        {data && (
          <div className="space-y-5 sm:space-y-6">
            {/* Executive Summary & AI Conviction */}
            <AnalysisSection icon={TrendingUp} title="Executive Summary & AI Conviction Rating">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-2xl font-semibold text-primary">AI Conviction: {data.conviction}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.assetLabel}</p>
                </div>
                <Badge variant="secondary" className="w-fit gap-1">
                  Ticker hidden until reservation
                </Badge>
              </div>
              <Progress value={data.conviction} className="mb-4" />
              <p>{data.sections.executiveSummary || "Analysis pending."}</p>
            </AnalysisSection>

            {/* Key metrics row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Latest close"
                value={data.fundamentals.latestClose ? formatUsd(data.fundamentals.latestClose) : "—"}
              />
              <MetricCard
                label="Daily change"
                value={
                  data.fundamentals.changePercent !== undefined
                    ? `${data.fundamentals.changePercent >= 0 ? "+" : ""}${data.fundamentals.changePercent}%`
                    : "—"
                }
                tone={
                  data.fundamentals.changePercent !== undefined && data.fundamentals.changePercent < 0
                    ? "bear"
                    : "bull"
                }
              />
              <MetricCard label="RSI (14)" value={data.technical.rsi14?.toFixed(1) ?? "—"} />
              <MetricCard
                label="Risk score"
                value={`${data.risk.score}/100`}
                tone={data.risk.score >= 65 ? "bull" : "bear"}
              />
            </div>

            {/* Technical Analysis */}
            <AnalysisSection icon={Activity} title="Technical Analysis Breakdown">
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <IndicatorPill label="Momentum" value={data.technical.momentumLabel} />
                <IndicatorPill label="MACD bias" value={data.technical.macdBias} />
                <IndicatorPill
                  label="RSI (14)"
                  value={data.technical.rsi14 !== undefined ? data.technical.rsi14.toFixed(1) : "—"}
                />
                <IndicatorPill
                  label="MACD histogram"
                  value={
                    data.technical.macdHistogram !== undefined
                      ? data.technical.macdHistogram.toFixed(4)
                      : "—"
                  }
                />
              </div>
              <p>{data.sections.technicalAnalysis || data.technical.momentumLabel}</p>
            </AnalysisSection>

            {/* Charts */}
            <div>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Interactive price & indicators
                </div>
                <div className="flex w-fit gap-1 rounded-lg border border-border bg-[#0B0E14] p-1">
                  <Button
                    size="sm"
                    variant={chartMode === "candlestick" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs"
                    onClick={() => setChartMode("candlestick")}
                  >
                    Candlestick
                  </Button>
                  <Button
                    size="sm"
                    variant={chartMode === "area" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs"
                    onClick={() => setChartMode("area")}
                  >
                    Area line
                  </Button>
                </div>
              </div>
              <AnalysisChartPanel data={data} viewMode={chartMode} />
            </div>

            {/* Financial Health & Risk */}
            <AnalysisSection icon={ShieldCheck} title="Financial Health & Risk Score">
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Risk score" value={`${data.risk.score}/100`} tone="bull" />
                <MetricCard label="P/E ratio" value={data.fundamentals.peRatio?.toFixed(2) ?? "—"} />
                <MetricCard
                  label="Debt / Equity"
                  value={data.fundamentals.debtToEquity?.toFixed(2) ?? "—"}
                />
              </div>
              <p className="mb-2 font-medium text-foreground">{data.risk.label}</p>
              <p className="mb-3 text-xs text-primary">{data.risk.depositGuarantee}</p>
              <p>{data.sections.financialHealth || "Fundamental metrics loaded from live market data."}</p>
            </AnalysisSection>

            {/* Target Entry & Reserve */}
            <AnalysisSection icon={Target} title="Target Entry Price & Reserve Strategy">
              <div className="mb-3 flex flex-wrap gap-3">
                {data.suggestedEntryPrice !== undefined && (
                  <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Suggested entry zone
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {formatUsd(data.suggestedEntryPrice)}
                    </p>
                  </div>
                )}
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Deposit cap
                  </p>
                  <p className="text-lg font-semibold">{data.depositCap}</p>
                </div>
              </div>
              <p>{data.sections.targetEntry || "Reserve capital before the window opens to lock allocation."}</p>
            </AnalysisSection>

            <p className="rounded-lg border border-border bg-[#0B0E14] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Ticker symbol and company identity remain hidden until you execute{" "}
              <span className="font-medium text-foreground">Fund & reserve</span>. All AI narrative
              passes anonymization filters. Last sync: {new Date(data.fetchedAt).toLocaleString()}.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border bg-[#121824] p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-base font-semibold sm:text-lg ${
          tone === "bull" ? "text-primary" : tone === "bear" ? "text-bear" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function IndicatorPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[#121824] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
