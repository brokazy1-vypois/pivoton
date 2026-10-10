import { GoogleGenAI } from "@google/genai";
import { buildPortfolioContext } from "@/data/dashboard-portfolio";

export type FinanceAgentMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SYSTEM_INSTRUCTION = `You are the Pivoton AI Finance Agent, an institutional-grade financial consultant specializing in stock valuation, portfolio hedging strategies, capital gains tax treatment, and broker call analysis.

STRICT RULE: You MUST ONLY answer questions related to financial investments, wealth management, trading, and portfolio analysis. If the user asks non-financial or off-topic questions (e.g., weather, cooking, general coding, pop culture), politely decline with: "I am specialized exclusively as a financial investment agent. Please ask me about valuation, hedging, stock tickers, or portfolio positions."

When referencing the user's holdings, use the portfolio context provided. Be concise, actionable, and professional. Use markdown for emphasis and bullet lists when helpful. Reference tickers with a $ prefix (e.g., $KRE, $NVDA).`;

let genaiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genaiClient) genaiClient = new GoogleGenAI({ apiKey });
  return genaiClient;
}

function buildSystemPrompt(): string {
  return `${SYSTEM_INSTRUCTION}\n\n${buildPortfolioContext()}`;
}

function buildContents(history: FinanceAgentMessage[], userMessage: string) {
  const turns = history
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.text }],
    }));

  return [
    ...turns,
    {
      role: "user" as const,
      parts: [{ text: userMessage }],
    },
  ];
}

function fallbackReply(userMessage: string): string {
  const q = userMessage.toLowerCase();

  if (
    !/(hedge|stock|ticker|portfolio|tax|valuation|broker|position|invest|etf|bank|gain|loss|call|trade|market|equity|bond|option|capital)/i.test(
      q,
    )
  ) {
    return "I am specialized exclusively as a financial investment agent. Please ask me about valuation, hedging, stock tickers, or portfolio positions.";
  }

  if (q.includes("banking") || q.includes("hedg")) {
    return `Your **Regional banking swing** ($1,240, **-2.1%**, **Uncovered**) is the priority hedge candidate in this book.

**Suggested approach:**
- Consider a **protective put** or **collar** on regional bank exposure (e.g., $KRE) sized to ~80–100% of notional.
- Your covered positions (ETF ladder + RM-4471) already absorb 86% portfolio protection — this swing is the gap.
- Limit additional downside to 3% insurance-fee framework by rolling into a **covered structure** if holding past the next earnings cycle.

Want me to compare collar vs. put spread cost for this size?`;
  }

  if (q.includes("tax") || q.includes("gain")) {
    return `For **realized gains** on your covered book:

- **Guaranteed ETF ladder A** (+4.2%, $8,420): Long-term vs. short-term treatment depends on lot holding period — harvest only after 12+ months if possible.
- Covered positions: the **3% loss fee** is deductible as an investment expense in many jurisdictions — confirm with your CPA.
- **Regional banking swing** (-2.1%): Uncovered losses may offset gains from Marisol Vega's **+6.4%** Pre-open Momentum call if realized in the same tax year.

I can walk through a lot-level gain/loss summary if you share cost basis.`;
  }

  if (q.includes("position") || q.includes("analyze") || q.includes("open")) {
    return `**Open positions snapshot:**

| Position | Value | P&L | Coverage |
|----------|-------|-----|----------|
| Guaranteed ETF ladder A | $8,420 | +4.2% | Covered |
| Semiconductor rumor RM-4471 | $3,100 | +1.8% | Covered |
| Regional banking swing | $1,240 | -2.1% | **Uncovered** |

**86%** of portfolio notional is in covered structures. The banking swing is your sole uncovered risk — prioritize hedging or trim size.

**Broker call context:** Marisol Vega's Pre-open Momentum (+6.4%) supports maintaining equity beta while you hedge the regional sleeve.`;
  }

  return `Based on your dashboard: **86% covered**, three open positions, and Marisol Vega's **+6.4%** Pre-open Momentum call on Mar 12.

Ask about a specific ticker, hedge, or tax scenario and I'll tie it to your book. *(Connect VITE_GEMINI_API_KEY for live Gemini analysis.)*`;
}

export async function* streamFinanceAgentReply(
  history: FinanceAgentMessage[],
  userMessage: string,
): AsyncGenerator<string, void, unknown> {
  const ai = getGeminiClient();

  if (!ai) {
    yield fallbackReply(userMessage);
    return;
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: buildContents(history, userMessage),
      config: {
        systemInstruction: buildSystemPrompt(),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch {
    yield fallbackReply(userMessage);
  }
}
