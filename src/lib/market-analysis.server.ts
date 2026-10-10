import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { parseAnalysisSections, sanitizeAnonymizedText } from "@/lib/anonymize-analysis";
import {
  getBlockedIdentifiers,
  resolveAssetMapping,
  resolveMarketRumor,
} from "@/lib/market-asset-map.server";
import { getGeminiApiKey, getTwelveDataApiKey } from "@/lib/server-env";
import type {
  AnalysisSections,
  AnonymizedMarketAnalysis,
  CandlePoint,
  IndicatorPoint,
  MacdPoint,
  MarketFundamentals,
  RiskSnapshot,
  TechnicalSnapshot,
} from "@/types/market-analysis";

const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const REQUEST_TIMEOUT_MS = 15_000;

function getTwelveDataKey(): string {
  return getTwelveDataApiKey();
}

function getGeminiKey(): string {
  return getGeminiApiKey();
}

function extractRefCodeFromCtx(ctx: unknown): unknown {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    return (ctx as { data: unknown }).data;
  }
  return ctx;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

async function twelveDataFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const apiKey = getTwelveDataKey();
  if (!apiKey) throw new Error("Twelve Data API key is not configured.");

  const url = new URL(`${TWELVE_DATA_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : `Twelve Data HTTP ${response.status}`;
    throw new Error(message);
  }

  if (isRecord(payload) && payload.status === "error") {
    throw new Error(String(payload.message ?? "Twelve Data request failed"));
  }

  return payload;
}

function parseCandles(payload: unknown): CandlePoint[] {
  if (!isRecord(payload) || !Array.isArray(payload.values)) return [];
  const candles = payload.values
    .map((row) => {
      if (!isRecord(row)) return null;
      const time = String(row.datetime ?? "").slice(0, 10);
      const open = toNumber(row.open);
      const high = toNumber(row.high);
      const low = toNumber(row.low);
      const close = toNumber(row.close);
      const volume = toNumber(row.volume) ?? 0;
      if (!time || open === undefined || high === undefined || low === undefined || close === undefined) {
        return null;
      }
      return { time, open, high, low, close, volume };
    })
    .filter(Boolean) as CandlePoint[];

  return candles.sort((a, b) => a.time.localeCompare(b.time));
}

function parseIndicatorSeries(payload: unknown, valueKey: string): IndicatorPoint[] {
  if (!isRecord(payload) || !Array.isArray(payload.values)) return [];
  const points = payload.values
    .map((row) => {
      if (!isRecord(row)) return null;
      const time = String(row.datetime ?? "").slice(0, 10);
      const value = toNumber(row[valueKey]);
      if (!time || value === undefined) return null;
      return { time, value };
    })
    .filter(Boolean) as IndicatorPoint[];

  return points.sort((a, b) => a.time.localeCompare(b.time));
}

function parseMacdSeries(payload: unknown): MacdPoint[] {
  if (!isRecord(payload) || !Array.isArray(payload.values)) return [];
  const points = payload.values
    .map((row) => {
      if (!isRecord(row)) return null;
      const time = String(row.datetime ?? "").slice(0, 10);
      const macd = toNumber(row.macd);
      const signal = toNumber(row.macd_signal ?? row.signal);
      const histogram = toNumber(row.macd_hist ?? row.histogram);
      if (!time || macd === undefined || signal === undefined || histogram === undefined) return null;
      return { time, macd, signal, histogram };
    })
    .filter(Boolean) as MacdPoint[];

  return points.sort((a, b) => a.time.localeCompare(b.time));
}

function parseFundamentals(
  statsPayload: unknown,
  candles: CandlePoint[],
): MarketFundamentals {
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const fundamentals: MarketFundamentals = {
    latestClose: latest?.close,
    changePercent:
      latest && previous
        ? Math.round(((latest.close - previous.close) / previous.close) * 10000) / 100
        : undefined,
  };

  if (isRecord(statsPayload) && isRecord(statsPayload.statistics)) {
    const stats = statsPayload.statistics;
    fundamentals.peRatio = toNumber(stats.pe_ratio ?? stats.trailing_pe ?? stats.pe);
    fundamentals.debtToEquity = toNumber(stats.debt_to_equity ?? stats.debt_equity);
  }

  return fundamentals;
}

function buildGeminiPrompt(input: {
  refCode: string;
  assetLabel: string;
  sector: string;
  index: string;
  conviction: number;
  candles: CandlePoint[];
  sma50: IndicatorPoint[];
  sma200: IndicatorPoint[];
  rsi: IndicatorPoint[];
  macd: MacdPoint[];
  fundamentals: MarketFundamentals;
}): string {
  const latestRsi = input.rsi[input.rsi.length - 1]?.value;
  const latestMacd = input.macd[input.macd.length - 1];
  const recentCloses = input.candles.slice(-10).map((c) => c.close);

  const metrics = {
    ref_code: input.refCode,
    asset_label: input.assetLabel,
    sector_exposure: input.sector,
    index_exposure: input.index,
    ai_conviction_score: input.conviction,
    latest_close: input.fundamentals.latestClose,
    daily_change_percent: input.fundamentals.changePercent,
    pe_ratio: input.fundamentals.peRatio,
    debt_to_equity: input.fundamentals.debtToEquity,
    rsi_14: latestRsi,
    macd: latestMacd
      ? {
          macd: latestMacd.macd,
          signal: latestMacd.signal,
          histogram: latestMacd.histogram,
        }
      : null,
    sma_50: input.sma50[input.sma50.length - 1]?.value,
    sma_200: input.sma200[input.sma200.length - 1]?.value,
    recent_close_prices: recentCloses,
    volume_last_session: input.candles[input.candles.length - 1]?.volume,
  };

  return `You are a Senior Quantitative Financial Analyst for Pivoton. Analyze the provided numerical market data.

STRICT COMPLIANCE RULES:
1. DO NOT reveal, mention, or hint at company names, brands, products, executives, or ticker symbols.
2. Refer to the asset ONLY as "Asset ${input.refCode}" or "${input.assetLabel}".
3. Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "executive_summary": "2-3 sentences on outlook and AI conviction context",
  "technical_analysis": "RSI & MACD momentum evaluation, trend vs SMA 50/200",
  "financial_health": "Balance sheet durability, revenue stability, deposit guarantee safety",
  "target_entry": "Target entry price range and reserve sizing strategy before window opens"
}
4. Keep each field 60-120 words, institutional tone.
5. Mention Pivoton's deposit guarantee (max 3% loss fee) in financial_health.

Numerical payload:
${JSON.stringify(metrics, null, 2)}`;
}

function sanitizeSections(sections: AnalysisSections): AnalysisSections {
  const blocked = getBlockedIdentifiers();
  return {
    executiveSummary: sanitizeAnonymizedText(sections.executiveSummary, blocked),
    technicalAnalysis: sanitizeAnonymizedText(sections.technicalAnalysis, blocked),
    financialHealth: sanitizeAnonymizedText(sections.financialHealth, blocked),
    targetEntry: sanitizeAnonymizedText(sections.targetEntry, blocked),
  };
}

function buildTechnicalSnapshot(
  rsi: IndicatorPoint[],
  macd: MacdPoint[],
  sma50: IndicatorPoint[],
  sma200: IndicatorPoint[],
): TechnicalSnapshot {
  const rsi14 = rsi[rsi.length - 1]?.value;
  const latestMacd = macd[macd.length - 1];
  const sma50Val = sma50[sma50.length - 1]?.value;
  const sma200Val = sma200[sma200.length - 1]?.value;

  let momentumLabel = "Neutral momentum";
  if (rsi14 !== undefined) {
    if (rsi14 >= 70) momentumLabel = "Overbought — momentum extended";
    else if (rsi14 <= 30) momentumLabel = "Oversold — potential reversal zone";
    else if (rsi14 >= 55) momentumLabel = "Bullish momentum building";
    else if (rsi14 <= 45) momentumLabel = "Bearish momentum pressure";
  }

  let macdBias = "MACD neutral";
  if (latestMacd) {
    if (latestMacd.histogram > 0 && latestMacd.macd > latestMacd.signal) {
      macdBias = "MACD bullish crossover bias";
    } else if (latestMacd.histogram < 0 && latestMacd.macd < latestMacd.signal) {
      macdBias = "MACD bearish crossover bias";
    }
  }

  return {
    rsi14,
    macd: latestMacd?.macd,
    macdSignal: latestMacd?.signal,
    macdHistogram: latestMacd?.histogram,
    sma50: sma50Val,
    sma200: sma200Val,
    momentumLabel,
    macdBias,
  };
}

function buildRiskSnapshot(
  conviction: number,
  fundamentals: MarketFundamentals,
): RiskSnapshot {
  let score = conviction;
  if (fundamentals.debtToEquity !== undefined) {
    if (fundamentals.debtToEquity > 2) score -= 15;
    else if (fundamentals.debtToEquity < 0.5) score += 5;
  }
  if (fundamentals.peRatio !== undefined) {
    if (fundamentals.peRatio > 40) score -= 10;
    else if (fundamentals.peRatio < 15) score += 5;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Moderate risk";
  if (score >= 80) label = "Low risk — strong coverage profile";
  else if (score >= 65) label = "Moderate-low risk";
  else if (score < 50) label = "Elevated risk — size reserves carefully";

  return {
    score,
    label,
    depositGuarantee: "Pivoton covered · max 3% loss fee",
  };
}

function computeSuggestedEntry(
  fundamentals: MarketFundamentals,
  sma50: IndicatorPoint[],
): number | undefined {
  const close = fundamentals.latestClose;
  const sma = sma50[sma50.length - 1]?.value;
  if (!close) return undefined;
  const anchor = sma ? Math.min(close, sma) : close;
  return Math.round(anchor * 0.985 * 100) / 100;
}

async function generateAnonymizedAnalysis(prompt: string): Promise<AnalysisSections> {
  const fallback: AnalysisSections = {
    executiveSummary: "Live market data loaded. AI briefing unavailable — configure Gemini to enable full narrative sections.",
    technicalAnalysis: "",
    financialHealth: "",
    targetEntry: "",
  };

  const apiKey = getGeminiKey();
  if (!apiKey) return fallback;

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const raw = (response.text ?? "").trim();
  if (!raw) return fallback;

  return sanitizeSections(parseAnalysisSections(raw));
}

export const fetchMarketAnalysisServer = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<AnonymizedMarketAnalysis> => {
    const refCode = extractRefCodeFromCtx(ctx);
    const rumor = resolveMarketRumor(refCode);
    if (!rumor) {
      throw new Error("Unknown asset reference code.");
    }

    const mapping = resolveAssetMapping(refCode);
    const symbol = mapping?.ticker;
    if (!symbol) {
      throw new Error("Asset mapping not found.");
    }

    const normalizedRef = rumor.id;

    const [timeSeries, rsiPayload, macdPayload, sma50Payload, sma200Payload, statsPayload] =
      await Promise.all([
        twelveDataFetch("/time_series", {
          symbol,
          interval: "1day",
          outputsize: "100",
        }),
        twelveDataFetch("/rsi", {
          symbol,
          interval: "1day",
          time_period: "14",
          outputsize: "100",
        }),
        twelveDataFetch("/macd", {
          symbol,
          interval: "1day",
          outputsize: "100",
        }),
        twelveDataFetch("/sma", {
          symbol,
          interval: "1day",
          time_period: "50",
          outputsize: "100",
        }),
        twelveDataFetch("/sma", {
          symbol,
          interval: "1day",
          time_period: "200",
          outputsize: "100",
        }),
        twelveDataFetch("/statistics", { symbol }).catch(() => null),
      ]);

    const candles = parseCandles(timeSeries);
    if (candles.length === 0) {
      throw new Error("No market data returned for this asset.");
    }

    const sma50 = parseIndicatorSeries(sma50Payload, "sma");
    const sma200 = parseIndicatorSeries(sma200Payload, "sma");
    const rsi = parseIndicatorSeries(rsiPayload, "rsi");
    const macd = parseMacdSeries(macdPayload);
    const fundamentals = parseFundamentals(statsPayload, candles);

    const sections = await generateAnonymizedAnalysis(
      buildGeminiPrompt({
        refCode: normalizedRef,
        assetLabel: rumor.assetLabel,
        sector: rumor.sector,
        index: rumor.index,
        conviction: rumor.conviction,
        candles,
        sma50,
        sma200,
        rsi,
        macd,
        fundamentals,
      }),
    );

    const technical = buildTechnicalSnapshot(rsi, macd, sma50, sma200);
    const risk = buildRiskSnapshot(rumor.conviction, fundamentals);
    const suggestedEntryPrice = computeSuggestedEntry(fundamentals, sma50);

    return {
      refCode: normalizedRef,
      assetLabel: rumor.assetLabel,
      sector: rumor.sector,
      index: rumor.index,
      conviction: rumor.conviction,
      depositCap: rumor.cap,
      candles,
      sma50,
      sma200,
      rsi,
      macd,
      fundamentals,
      sections,
      technical,
      risk,
      suggestedEntryPrice,
      fetchedAt: new Date().toISOString(),
    };
  },
);
