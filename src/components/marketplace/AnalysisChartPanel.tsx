import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { AnonymizedMarketAnalysis, ChartViewMode } from "@/types/market-analysis";

const CHART_BG = "#0B0E14";
const PANEL_BG = "#121824";
const GRID = "#1e293b";
const TEXT = "#94a3b8";
const BULL = "#10B981";
const BEAR = "#EF4444";
const SMA50 = "#38bdf8";
const SMA200 = "#a78bfa";

interface AnalysisChartPanelProps {
  data: AnonymizedMarketAnalysis;
  viewMode: ChartViewMode;
}

function toChartTime(time: string): Time {
  return time as Time;
}

export function AnalysisChartPanel({ data, viewMode }: AnalysisChartPanelProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current) return;

    const charts: IChartApi[] = [];
    const cleanups: Array<() => void> = [];

    const baseOptions = {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    };

    const mainChart = createChart(mainRef.current, {
      ...baseOptions,
      width: mainRef.current.clientWidth,
      height: 280,
    });
    charts.push(mainChart);

    if (viewMode === "candlestick") {
      const candleSeries = mainChart.addSeries(CandlestickSeries, {
        upColor: BULL,
        downColor: BEAR,
        borderUpColor: BULL,
        borderDownColor: BEAR,
        wickUpColor: BULL,
        wickDownColor: BEAR,
      });
      candleSeries.setData(
        data.candles.map((c) => ({
          time: toChartTime(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else {
      const areaSeries = mainChart.addSeries(AreaSeries, {
        lineColor: BULL,
        topColor: "rgba(16, 185, 129, 0.35)",
        bottomColor: "rgba(16, 185, 129, 0.02)",
      });
      areaSeries.setData(
        data.candles.map((c) => ({
          time: toChartTime(c.time),
          value: c.close,
        })),
      );
    }

    if (data.sma50.length > 0) {
      const sma50Series = mainChart.addSeries(LineSeries, {
        color: SMA50,
        lineWidth: 2,
        title: "SMA 50",
      });
      sma50Series.setData(
        data.sma50.map((p) => ({ time: toChartTime(p.time), value: p.value })),
      );
    }

    if (data.sma200.length > 0) {
      const sma200Series = mainChart.addSeries(LineSeries, {
        color: SMA200,
        lineWidth: 2,
        title: "SMA 200",
      });
      sma200Series.setData(
        data.sma200.map((p) => ({ time: toChartTime(p.time), value: p.value })),
      );
    }

    const rsiChart = createChart(rsiRef.current, {
      ...baseOptions,
      width: rsiRef.current.clientWidth,
      height: 120,
    });
    charts.push(rsiChart);

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#fbbf24",
      lineWidth: 2,
    });
    rsiSeries.setData(data.rsi.map((p) => ({ time: toChartTime(p.time), value: p.value })));

    const rsiUpper = rsiChart.addSeries(LineSeries, {
      color: "#475569",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const rsiLower = rsiChart.addSeries(LineSeries, {
      color: "#475569",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    if (data.rsi.length > 0) {
      const band = data.rsi.map((p) => ({ time: toChartTime(p.time), value: 70 }));
      const bandLow = data.rsi.map((p) => ({ time: toChartTime(p.time), value: 30 }));
      rsiUpper.setData(band);
      rsiLower.setData(bandLow);
    }

    const macdChart = createChart(macdRef.current, {
      ...baseOptions,
      width: macdRef.current.clientWidth,
      height: 130,
    });
    charts.push(macdChart);

    const macdHist = macdChart.addSeries(HistogramSeries, {
      color: BULL,
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    });
    macdHist.setData(
      data.macd.map((p) => ({
        time: toChartTime(p.time),
        value: p.histogram,
        color: p.histogram >= 0 ? BULL : BEAR,
      })),
    );

    const macdLine = macdChart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2 });
    macdLine.setData(data.macd.map((p) => ({ time: toChartTime(p.time), value: p.macd })));

    const signalLine = macdChart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2 });
    signalLine.setData(data.macd.map((p) => ({ time: toChartTime(p.time), value: p.signal })));

    const syncHandler = (source: IChartApi) => {
      const range = source.timeScale().getVisibleLogicalRange();
      if (!range) return;
      for (const chart of charts) {
        if (chart !== source) chart.timeScale().setVisibleLogicalRange(range);
      }
    };

    for (const chart of charts) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => syncHandler(chart));
    }

    mainChart.timeScale().fitContent();
    rsiChart.timeScale().fitContent();
    macdChart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (mainRef.current) mainChart.applyOptions({ width: mainRef.current.clientWidth });
      if (rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
      if (macdRef.current) macdChart.applyOptions({ width: macdRef.current.clientWidth });
    });

    resizeObserver.observe(mainRef.current);
    resizeObserver.observe(rsiRef.current);
    resizeObserver.observe(macdRef.current);

    cleanups.push(() => {
      resizeObserver.disconnect();
      for (const chart of charts) chart.remove();
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [data, viewMode]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-[#0B0E14] p-2">
        <div ref={mainRef} className="w-full" />
      </div>
      <div className="rounded-lg border border-border bg-[#121824] p-2">
        <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">RSI (14)</p>
        <div ref={rsiRef} className="w-full" />
      </div>
      <div className="rounded-lg border border-border bg-[#121824] p-2">
        <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">MACD (12, 26, 9)</p>
        <div ref={macdRef} className="w-full" />
      </div>
    </div>
  );
}
