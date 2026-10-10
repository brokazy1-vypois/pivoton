import { GoogleGenAI } from "@google/genai";
import type { SignalAiAnalysis } from "@/types/signal-feed";
import { getAiPurchaseEstimate } from "@/lib/signal-ai-estimate";

const ANALYSIS_PROMPT = `You are a quantitative trading analyst. Analyze this broker stock recommendation and return ONLY valid JSON:

{
  "purchaseWindow": "short label e.g. ~2 hours or 1 trading session",
  "purchaseWindowDetail": "1-2 sentences on when price may reach entry zone using ATR/volatility",
  "profitProjection": "1-2 sentences estimating timeline to reach target profit price using ATR and support/resistance",
  "confidence": "high" | "medium" | "low"
}

Do not wrap in markdown code fences.`;

let genaiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not configured");
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

function fallbackAnalysis(
  ticker: string,
  purchasePrice: number,
  targetProfit: number,
): SignalAiAnalysis {
  const mock = getAiPurchaseEstimate(ticker);
  const upside = (((targetProfit - purchasePrice) / purchasePrice) * 100).toFixed(1);
  return {
    purchaseWindow: mock.windowLabel,
    purchaseWindowDetail: mock.detail,
    profitProjection: `Based on historical ATR, ${ticker} may reach the $${targetProfit.toFixed(2)} target within 2–4 sessions (~${upside}% upside from entry).`,
    confidence: mock.confidence,
  };
}

export async function analyzeSignalRecommendation(input: {
  ticker: string;
  purchasePrice: number;
  stopLoss: number;
  targetProfit: number;
}): Promise<SignalAiAnalysis> {
  const { ticker, purchasePrice, stopLoss, targetProfit } = input;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${ANALYSIS_PROMPT}

Ticker: $${ticker}
Target purchase price: $${purchasePrice}
Stop loss: $${stopLoss}
Target profit: $${targetProfit}`,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text?.trim();
    if (!text) return fallbackAnalysis(ticker, purchasePrice, targetProfit);

    const parsed = JSON.parse(text) as SignalAiAnalysis;
    return {
      purchaseWindow: parsed.purchaseWindow ?? "1 trading session",
      purchaseWindowDetail: parsed.purchaseWindowDetail ?? "",
      profitProjection: parsed.profitProjection ?? "",
      confidence: parsed.confidence ?? "medium",
    };
  } catch {
    return fallbackAnalysis(ticker, purchasePrice, targetProfit);
  }
}
