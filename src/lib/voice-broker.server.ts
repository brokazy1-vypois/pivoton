import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { buildPortfolioContext } from "@/data/dashboard-portfolio";
import { getGeminiApiKey, getServerEnv } from "@/lib/server-env";

const FINANCE_SYSTEM = `You are the Pivoton AI Voice Broker — a concise, spoken financial advisor.
Answer in 2-4 short sentences suitable for text-to-speech. Focus on investments, hedging, valuation, and portfolio risk.
Use the portfolio context when relevant. Do not use markdown tables or bullet lists — plain spoken prose only.`;

function extractTranscript(ctx: unknown): string {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (typeof data === "string") return data.trim();
    if (data && typeof data === "object" && "transcript" in data) {
      return String((data as { transcript: string }).transcript).trim();
    }
  }
  if (typeof ctx === "string") return ctx.trim();
  return "";
}

async function callRocketRide(transcript: string): Promise<string | null> {
  const endpoint =
    getServerEnv("ROCKETRIDE_ENDPOINT", "VITE_ROCKETRIDE_ENDPOINT") ||
    "https://api.rocketride.ai/chat";
  const publicKey = getServerEnv("ROCKETRIDE_PUBLIC_KEY", "VITE_ROCKETRIDE_PUBLIC_KEY");
  const privateToken = getServerEnv("ROCKETRIDE_PRIVATE_TOKEN", "VITE_ROCKETRIDE_PRIVATE_TOKEN");

  if (!publicKey && !privateToken) return null;

  const payloads = [
    {
      api_key: publicKey,
      token: privateToken,
      question: transcript,
      message: transcript,
    },
    {
      public_key: publicKey,
      pipeline_token: privateToken,
      input: transcript,
    },
    { message: transcript, stream: false },
  ];

  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(publicKey ? { "x-api-key": publicKey, Authorization: `Bearer ${publicKey}` } : {}),
  };

  for (const body of payloads) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });

      const text = await response.text();
      if (!response.ok) continue;

      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        const answer =
          json.answer ??
          json.response ??
          json.message ??
          json.data ??
          (json.result as Record<string, unknown> | undefined)?.answer;
        if (typeof answer === "string" && answer.trim()) return answer.trim();
        if (typeof json.data === "object" && json.data && "answer" in (json.data as object)) {
          const nested = (json.data as { answer?: string }).answer;
          if (nested?.trim()) return nested.trim();
        }
      } catch {
        if (text.trim() && !text.includes("<html")) return text.trim().slice(0, 2000);
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function callGemini(transcript: string, rocketContext: string | null): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return rocketContext ??
      "I can help with portfolio and hedging questions once Gemini is connected.";
  }

  const client = new GoogleGenAI({ apiKey });
  const prompt = rocketContext
    ? `User asked (via voice): "${transcript}"\n\nPipeline context:\n${rocketContext}\n\nRespond as the Pivoton Voice Broker.`
    : `User asked (via voice): "${transcript}"\n\nRespond as the Pivoton Voice Broker.`;

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: `${FINANCE_SYSTEM}\n\n${buildPortfolioContext()}`,
    },
  });

  return (response.text ?? "").trim() || "I couldn't generate a response. Please try again.";
}

export const processVoiceBrokerPromptServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ reply: string }> => {
    const transcript = extractTranscript(ctx);
    if (!transcript) {
      throw new Error("No speech detected. Please try again.");
    }

    const rocketReply = await callRocketRide(transcript);
    const reply = await callGemini(transcript, rocketReply);

    return { reply: reply.replace(/\*\*/g, "").replace(/\$/g, " dollars ") };
  },
);
