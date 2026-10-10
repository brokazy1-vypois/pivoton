import { GoogleGenAI } from "@google/genai";
import type { FinancialInsight, MeetingSummary } from "@/types/meeting";

const SUMMARY_PROMPT = `Analyze this broker consultancy call transcript and produce a concise post-meeting executive summary.

Return ONLY valid JSON:
{
  "executiveSummary": "2-3 sentence overview",
  "tickers": ["TSLA", "AAPL"],
  "recommendations": [
    {
      "ticker": "TSLA",
      "action": "Buy",
      "entry": "$240",
      "target": "$280",
      "stop": "$225"
    }
  ],
  "actionItems": ["bullet point next steps"]
}`;

export interface SummaryContext {
  brokerName?: string;
  roomName?: string;
  insights?: FinancialInsight[];
}

function extractTickersFromText(text: string): string[] {
  const matches = text.match(/\$?([A-Z]{1,5})\b/g) ?? [];
  const skip = new Set(["I", "A", "AI", "OK", "PM", "AM", "ETF", "IPO"]);
  return [
    ...new Set(
      matches
        .map((m) => m.replace(/^\$/, ""))
        .filter((t) => t.length >= 2 && !skip.has(t)),
    ),
  ];
}

function parseSummaryJson(text: string): MeetingSummary | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as MeetingSummary;
    return {
      executiveSummary: parsed.executiveSummary ?? "Session summary captured.",
      tickers: parsed.tickers ?? [],
      recommendations: parsed.recommendations ?? [],
      actionItems: parsed.actionItems ?? [],
    };
  } catch {
    return null;
  }
}

export function buildFallbackSummary(
  transcript: string,
  context: SummaryContext = {},
): MeetingSummary {
  const { brokerName, roomName, insights = [] } = context;
  const trimmed = transcript.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const insightTickers = insights
    .map((i) => i.ticker?.replace(/^\$/, ""))
    .filter((t): t is string => Boolean(t));

  const tickers = [
    ...new Set([...extractTickersFromText(trimmed), ...insightTickers]),
  ];

  const recommendations = insights
    .filter((i) => i.ticker)
    .map((i) => ({
      ticker: i.ticker!.replace(/^\$/, ""),
      action: (i.action ?? "hold").charAt(0).toUpperCase() + (i.action ?? "hold").slice(1),
      entry: i.entryPrice,
      target: i.targetPrice,
      stop: i.stopLoss,
    }));

  const preview = trimmed
    ? trimmed.slice(0, 280) + (trimmed.length > 280 ? "…" : "")
    : "";

  let executiveSummary: string;
  if (trimmed) {
    executiveSummary = `Consultancy session with ${brokerName ?? "your broker"}${roomName ? ` (${roomName})` : ""} captured approximately ${wordCount} spoken words. ${preview ? `Opening context: "${preview}"` : ""} Review trade levels and action items below before acting on any recommendation.`;
  } else {
    executiveSummary = `The call with ${brokerName ?? "your broker"}${roomName ? ` in ${roomName}` : ""} ended with limited live transcription. Any financial highlights extracted during the session are listed below — open Call History to paste manual notes if needed.`;
  }

  const actionItems =
    recommendations.length > 0
      ? [
          "Confirm all entry, target, and stop levels with your broker",
          "Log intended position size before placing orders",
          "Review full transcript in Private Room call history",
        ]
      : trimmed
        ? [
            "Review the full transcript in Private Room call history",
            "Follow up with your broker on any open action items",
          ]
        : [
            "Rejoin or schedule a follow-up if transcription was incomplete",
            "Copy manual notes from the session into your trade journal",
          ];

  return {
    executiveSummary,
    tickers,
    recommendations,
    actionItems,
  };
}

async function summarizeWithGemini(transcript: string): Promise<MeetingSummary | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${SUMMARY_PROMPT}\n\nTranscript:\n${transcript}`,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text?.trim();
  if (!text) return null;
  return parseSummaryJson(text);
}

export function meetingSummaryToMarkdown(summary: MeetingSummary): string {
  const lines: string[] = [
    "## Executive Summary",
    summary.executiveSummary,
    "",
  ];

  if (summary.tickers.length > 0) {
    lines.push("## Key Tickers", summary.tickers.map((t) => `$${t.replace(/^\$/, "")}`).join(", "), "");
  }

  if (summary.recommendations.length > 0) {
    lines.push("## Trade Recommendations");
    for (const rec of summary.recommendations) {
      lines.push(
        `- **$${rec.ticker.replace(/^\$/, "")}** · ${rec.action}${rec.entry ? ` · Entry ${rec.entry}` : ""}${rec.target ? ` · Target ${rec.target}` : ""}${rec.stop ? ` · Stop ${rec.stop}` : ""}`,
      );
    }
    lines.push("");
  }

  if (summary.actionItems.length > 0) {
    lines.push("## Action Items");
    for (const item of summary.actionItems) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}

/** Generates post-call summary — never throws; always returns structured output. */
export async function generateMeetingSummary(
  transcript: string,
  context: SummaryContext = {},
): Promise<MeetingSummary> {
  const trimmed = transcript.trim();

  if (!trimmed) {
    return buildFallbackSummary("", context);
  }

  try {
    const gemini = await summarizeWithGemini(trimmed);
    if (gemini) return gemini;
  } catch {
    // fall through to structured fallback
  }

  return buildFallbackSummary(trimmed, context);
}

/** @deprecated Use generateMeetingSummary */
export const generatePostCallSummary = generateMeetingSummary;
