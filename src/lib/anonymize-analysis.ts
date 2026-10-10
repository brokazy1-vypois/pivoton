const FINANCIAL_WHITELIST = new Set([
  "AI",
  "API",
  "ATH",
  "ATR",
  "CEO",
  "CFO",
  "COO",
  "CPI",
  "EPS",
  "ETF",
  "EUR",
  "FCF",
  "GDP",
  "IPO",
  "MACD",
  "OHLC",
  "P/E",
  "PMI",
  "POS",
  "ROI",
  "RSI",
  "SEC",
  "SMA",
  "USD",
  "VIX",
  "YOY",
  "QOQ",
  "RM",
]);

const EXCHANGE_TICKER_PATTERN = /\b(?:NASDAQ|NYSE|AMEX|ARCA|BATS)\s*:\s*[A-Z]{1,5}\b/gi;
const DOLLAR_TICKER_PATTERN = /\$[A-Z]{1,5}\b/g;

/** Strip or redact leaked identifiers from Gemini output. */
export function sanitizeAnonymizedText(
  text: string,
  blockedTerms: string[] = [],
): string {
  let result = text;

  for (const term of blockedTerms) {
    if (!term.trim()) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[REDACTED]");
  }

  result = result.replace(DOLLAR_TICKER_PATTERN, "[REDACTED]");
  result = result.replace(EXCHANGE_TICKER_PATTERN, "[REDACTED]");

  result = result.replace(/\b[A-Z]{2,5}\b/g, (match) =>
    FINANCIAL_WHITELIST.has(match) ? match : "[REDACTED]",
  );

  result = result.replace(
    /\b(?:Inc\.?|Corp\.?|Corporation|Company|Holdings|Group|Ltd\.?|LLC|PLC)\b/gi,
    "[REDACTED]",
  );

  return result.replace(/\s{2,}/g, " ").trim();
}

export interface ParsedAnalysisSections {
  executiveSummary: string;
  technicalAnalysis: string;
  financialHealth: string;
  targetEntry: string;
}

export function parseAnalysisSections(raw: string): ParsedAnalysisSections {
  const fallback = {
    executiveSummary: raw,
    technicalAnalysis: "",
    financialHealth: "",
    targetEntry: "",
  };

  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    return {
      executiveSummary: parsed.executive_summary ?? parsed.executiveSummary ?? fallback.executiveSummary,
      technicalAnalysis: parsed.technical_analysis ?? parsed.technicalAnalysis ?? "",
      financialHealth: parsed.financial_health ?? parsed.financialHealth ?? "",
      targetEntry: parsed.target_entry ?? parsed.targetEntry ?? "",
    };
  } catch {
    return extractSectionsFromMarkdown(raw);
  }
}

function extractSectionsFromMarkdown(raw: string): ParsedAnalysisSections {
  const sections: ParsedAnalysisSections = {
    executiveSummary: "",
    technicalAnalysis: "",
    financialHealth: "",
    targetEntry: "",
  };

  const headings: Array<{ key: keyof ParsedAnalysisSections; patterns: RegExp[] }> = [
    {
      key: "executiveSummary",
      patterns: [/executive summary/i, /overview/i, /conviction/i],
    },
    {
      key: "technicalAnalysis",
      patterns: [/technical/i, /momentum/i, /rsi/i, /macd/i],
    },
    {
      key: "financialHealth",
      patterns: [/financial health/i, /risk score/i, /balance sheet/i, /fundamental/i],
    },
    {
      key: "targetEntry",
      patterns: [/target entry/i, /entry price/i, /reserve strategy/i, /price target/i],
    },
  ];

  const blocks = raw.split(/^##\s+/m).filter(Boolean);
  if (blocks.length <= 1) {
    sections.executiveSummary = raw;
    return sections;
  }

  for (const block of blocks) {
    const [titleLine, ...bodyLines] = block.split("\n");
    const title = titleLine?.trim() ?? "";
    const body = bodyLines.join("\n").trim();
    const match = headings.find((h) => h.patterns.some((p) => p.test(title)));
    if (match) sections[match.key] = body;
    else if (!sections.executiveSummary) sections.executiveSummary = body;
  }

  if (!sections.executiveSummary) sections.executiveSummary = raw;
  return sections;
}
