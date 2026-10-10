import { GoogleGenAI } from "@google/genai";
import type { FinancialInsight } from "@/types/meeting";

const EXTRACTION_PROMPT = `You are a financial analyst assistant. Extract actionable trading information from this broker consultancy call transcript segment.

Return ONLY valid JSON with this shape:
{
  "insights": [
    {
      "ticker": "TSLA",
      "action": "buy" | "sell" | "hold" | null,
      "entryPrice": "string or null",
      "targetPrice": "string or null",
      "stopLoss": "string or null",
      "orderType": "market" | "limit" | "stop" | "stop-limit" | "other" | null,
      "sentiment": "bullish" | "bearish" | "neutral" | null,
      "insight": "one concise actionable sentence or null"
    }
  ]
}

Rules:
- Only include tickers explicitly mentioned (with or without $ prefix).
- Use null for fields not mentioned.
- Return {"insights": []} if nothing financial is detected.
- Do not wrap in markdown code fences.`;

let genaiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not configured");
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

type RawInsight = {
  ticker?: string | null;
  action?: "buy" | "sell" | "hold" | null;
  entryPrice?: string | null;
  targetPrice?: string | null;
  stopLoss?: string | null;
  orderType?: FinancialInsight["orderType"] | null;
  sentiment?: FinancialInsight["sentiment"] | null;
  insight?: string | null;
};

export async function extractFinancialInsights(
  transcriptChunk: string,
): Promise<FinancialInsight[]> {
  if (!transcriptChunk.trim()) return [];

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${EXTRACTION_PROMPT}\n\nTranscript:\n${transcriptChunk}`,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text?.trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as { insights?: RawInsight[] };
    const now = Date.now();
    return (parsed.insights ?? [])
      .filter((i) => i.ticker || i.insight || i.action)
      .map((i, idx) => ({
        id: `${now}-${idx}`,
        ticker: i.ticker?.replace(/^\$/, "") ?? undefined,
        action: i.action ?? undefined,
        entryPrice: i.entryPrice ?? undefined,
        targetPrice: i.targetPrice ?? undefined,
        stopLoss: i.stopLoss ?? undefined,
        orderType: i.orderType ?? undefined,
        sentiment: i.sentiment ?? undefined,
        insight: i.insight ?? undefined,
        timestamp: now,
      }));
  } catch {
    return [];
  }
}
