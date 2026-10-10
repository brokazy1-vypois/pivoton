import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildPortfolioContext } from "@/data/dashboard-portfolio";
import { getGeminiApiKey, getServerEnv, getTwelveDataApiKey } from "@/lib/server-env";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const BROKER_SYSTEM = `You are an elite Senior Financial Broker & Quantitative Analyst on Pivoton.
Deliver a structured, deep-dive analysis covering both Fundamental Analysis (PE, Revenue, Moat) and Technical Analysis (Support/Resistance, RSI, Trend Momentum) similar to the Pivoton Marketplace recommendations.
Keep responses concise for voice (4-8 sentences). Plain spoken prose — no markdown tables or bullet lists.`;

const TICKER_STOP_WORDS = new Set([
  "A",
  "I",
  "AI",
  "AM",
  "AN",
  "AND",
  "ARE",
  "AS",
  "AT",
  "BE",
  "BY",
  "DO",
  "FOR",
  "GO",
  "HI",
  "IF",
  "IN",
  "IS",
  "IT",
  "ME",
  "MY",
  "NO",
  "OF",
  "OK",
  "ON",
  "OR",
  "SO",
  "TO",
  "UP",
  "US",
  "WE",
  "THE",
  "USD",
  "ETF",
  "CEO",
  "IPO",
  "PE",
  "RSI",
  "SMA",
]);

export interface TickerSnapshot {
  symbol: string;
  price?: number;
  changePercent?: number;
  volume?: number;
  rsi14?: number;
  sma50?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

function extractQuery(ctx: unknown): string {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (typeof data === "string") return data.trim();
    if (data && typeof data === "object" && "query" in data) {
      return String((data as { query: string }).query).trim();
    }
  }
  if (typeof ctx === "string") return ctx.trim();
  return "";
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function hashQuery(normalized: string): string {
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `broker_${Math.abs(hash).toString(36)}_${normalized.length}`;
}

function extractTickers(query: string): string[] {
  const upper = query.toUpperCase();
  const dollarMatches = upper.match(/\$([A-Z]{1,5})\b/g) ?? [];
  const plainMatches = upper.match(/\b[A-Z]{2,5}\b/g) ?? [];

  const tickers = new Set<string>();
  for (const match of dollarMatches) {
    tickers.add(match.replace("$", ""));
  }
  for (const match of plainMatches) {
    if (!TICKER_STOP_WORDS.has(match)) tickers.add(match);
  }

  return [...tickers].slice(0, 3);
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

function getServerSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;
  return createClient(url, key);
}

async function twelveDataFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const apiKey = getTwelveDataApiKey();
  if (!apiKey) return null;

  const url = new URL(`${TWELVE_DATA_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  if (isRecord(payload) && payload.status === "error") return null;
  return payload;
}

async function fetchTickerSnapshot(symbol: string): Promise<TickerSnapshot | null> {
  const [quotePayload, rsiPayload, smaPayload] = await Promise.all([
    twelveDataFetch("/quote", { symbol }),
    twelveDataFetch("/rsi", { symbol, interval: "1day", time_period: "14" }),
    twelveDataFetch("/sma", { symbol, interval: "1day", time_period: "50" }),
  ]);

  if (!isRecord(quotePayload)) return null;

  const rsiValues = isRecord(rsiPayload) && Array.isArray(rsiPayload.values)
    ? rsiPayload.values
    : [];
  const smaValues = isRecord(smaPayload) && Array.isArray(smaPayload.values)
    ? smaPayload.values
    : [];

  const latestRsi = rsiValues[0] as Record<string, unknown> | undefined;
  const latestSma = smaValues[0] as Record<string, unknown> | undefined;

  return {
    symbol,
    price: toNumber(quotePayload.close ?? quotePayload.price),
    changePercent: toNumber(quotePayload.percent_change),
    volume: toNumber(quotePayload.volume),
    rsi14: latestRsi ? toNumber(latestRsi.rsi) : undefined,
    sma50: latestSma ? toNumber(latestSma.sma) : undefined,
    fiftyTwoWeekHigh: toNumber(
      isRecord(quotePayload.fifty_two_week) ? quotePayload.fifty_two_week.high : undefined,
    ),
    fiftyTwoWeekLow: toNumber(
      isRecord(quotePayload.fifty_two_week) ? quotePayload.fifty_two_week.low : undefined,
    ),
  };
}

async function fetchTickerMetrics(tickers: string[]): Promise<TickerSnapshot[]> {
  if (!tickers.length) return [];
  const results = await Promise.all(tickers.map((symbol) => fetchTickerSnapshot(symbol)));
  return results.filter((row): row is TickerSnapshot => row !== null);
}

async function lookupCache(queryHash: string): Promise<string | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ai_broker_cache")
    .select("response, expires_at")
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (error || !data) return null;

  const expiresAt = new Date(data.expires_at as string).getTime();
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return null;

  return typeof data.response === "string" ? data.response : null;
}

async function saveCache(
  queryHash: string,
  queryText: string,
  response: string,
  tickers: string[],
): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase.from("ai_broker_cache").upsert(
    {
      query_hash: queryHash,
      query_text: queryText,
      response,
      tickers,
      expires_at: expiresAt,
    },
    { onConflict: "query_hash" },
  );
}

function formatMarketContext(metrics: TickerSnapshot[]): string {
  if (!metrics.length) return "No live ticker metrics available for this query.";

  return metrics
    .map((m) => {
      const parts = [
        `${m.symbol}: price ${m.price ?? "n/a"}`,
        m.changePercent !== undefined ? `change ${m.changePercent.toFixed(2)}%` : null,
        m.rsi14 !== undefined ? `RSI(14) ${m.rsi14.toFixed(1)}` : null,
        m.sma50 !== undefined ? `SMA(50) ${m.sma50.toFixed(2)}` : null,
        m.volume !== undefined ? `volume ${Math.round(m.volume).toLocaleString()}` : null,
      ].filter(Boolean);
      return parts.join(", ");
    })
    .join("\n");
}

async function generateGeminiAnalysis(query: string, metrics: TickerSnapshot[]): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return "Market analysis is unavailable until Gemini is configured. Please add VITE_GEMINI_API_KEY.";
  }

  const client = new GoogleGenAI({ apiKey });
  const marketBlock = formatMarketContext(metrics);

  const prompt = `User voice query: "${query}"

Live Twelve Data metrics:
${marketBlock}

Portfolio context:
${buildPortfolioContext()}

Provide a spoken financial broker response with fundamental and technical insight.`;

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: BROKER_SYSTEM },
  });

  const text = (response.text ?? "").trim();
  return text || "I couldn't generate an analysis. Please try again.";
}

function sanitizeForSpeech(text: string): string {
  return text.replace(/\*\*/g, "").replace(/#{1,6}\s/g, "").replace(/\$/g, " dollars ");
}

export const processBrokerQueryServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ response: string; fromCache: boolean }> => {
    const query = extractQuery(ctx);
    if (!query) {
      throw new Error("No query provided.");
    }

    const normalized = normalizeQuery(query);
    const queryHash = hashQuery(normalized);

    const cached = await lookupCache(queryHash);
    if (cached) {
      return { response: sanitizeForSpeech(cached), fromCache: true };
    }

    const tickers = extractTickers(query);
    const metrics = await fetchTickerMetrics(tickers);
    const analysis = await generateGeminiAnalysis(query, metrics);
    const response = sanitizeForSpeech(analysis);

    await saveCache(queryHash, query, response, tickers);

    return { response, fromCache: false };
  },
);
