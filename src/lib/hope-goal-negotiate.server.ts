import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/server-env";
import type { NegotiateStepResult, StepChatMessage } from "@/types/hope-goal";

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

function parseNegotiateJson(text: string): NegotiateStepResult | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as NegotiateStepResult;
    if (typeof parsed.accepted !== "boolean" || !parsed.title) return null;
    return {
      accepted: parsed.accepted,
      title: String(parsed.title).trim(),
      criteria: String(parsed.criteria ?? parsed.title).trim(),
      assistant_reply: String(parsed.assistant_reply ?? "").trim() || "Step updated.",
    };
  } catch {
    return null;
  }
}

async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; mimeType: string } | null> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { data: buffer.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function formatHistoryLine(msg: StepChatMessage): string {
  const attachmentNote =
    msg.attachment_url && msg.attachment_type
      ? ` [attachment: ${msg.attachment_type} — ${msg.attachment_url}]`
      : "";
  return `${msg.role.toUpperCase()}: ${msg.content}${attachmentNote}`;
}

function isGeminiRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("resource has been exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  );
}

function buildRateLimitFallback(
  stepTitle: string,
  criteria: string,
): NegotiateStepResult {
  return {
    accepted: false,
    title: stepTitle,
    criteria,
    assistant_reply: "Rate limit reached. Please wait a moment before sending another request.",
  };
}

/** Human–AI step negotiation — returns structured box updates (TanStack server fn). */
export const negotiateGoalStepServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<NegotiateStepResult> => {
    const data = extractData(ctx);
    const goalTitle = String(data.goalTitle ?? "");
    const stepTitle = String(data.stepTitle ?? "");
    const criteria = String(data.criteria ?? stepTitle);
    const userMessage = String(data.userMessage ?? "");
    const history = (data.history as StepChatMessage[] | undefined) ?? [];
    const proofImageUrls = ((data.proofImageUrls as string[] | undefined) ?? []).filter(Boolean);

    if (!stepTitle || !userMessage) {
      throw new Error("Step context and message are required.");
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return {
        accepted: true,
        title: stepTitle,
        criteria: `${criteria}\n(Adjusted: ${userMessage.slice(0, 120)})`,
        assistant_reply:
          "Gemini is not configured — I've noted your adjustment locally. Configure VITE_GEMINI_API_KEY for AI negotiation.",
      };
    }

    const historyText = history.slice(-8).map(formatHistoryLine).join("\n");
    const latestProofUrl = proofImageUrls.at(-1) ?? null;
    const proofImage = latestProofUrl ? await fetchImageAsBase64(latestProofUrl) : null;

    const prompt = `You are an objective goal coach helping a user refine a single step in their hope-to-goal plan on Pivoton.

Overall goal: ${goalTitle}
Current step title: ${stepTitle}
Current success criteria: ${criteria}

Conversation so far:
${historyText || "(none)"}

Uploaded proof images in this step's discussion:
${proofImageUrls.length ? proofImageUrls.join("\n") : "(none)"}
${proofImage ? "\nThe latest uploaded proof image is attached for visual context." : ""}

User message:
${userMessage}

When proof images were uploaded, factor what they show into your coaching. Decide whether to accept a step adjustment. If the user asks to split, merge, reword, or change criteria, update the step box accordingly.

Return ONLY valid JSON:
{
  "accepted": true or false,
  "title": "updated step title (max 12 words)",
  "criteria": "clear measurable criteria for verifying this step",
  "assistant_reply": "1-3 sentences explaining your decision to the user"
}`;

    const ai = new GoogleGenAI({ apiKey });
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (proofImage) {
      parts.push({ inlineData: { mimeType: proofImage.mimeType, data: proofImage.data } });
    }
    parts.push({ text: prompt });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts }],
        config: { responseMimeType: "application/json" },
      });

      const parsed = parseNegotiateJson(response.text ?? "");
      if (parsed) return parsed;
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        return buildRateLimitFallback(stepTitle, criteria);
      }
      throw error;
    }

    return {
      accepted: false,
      title: stepTitle,
      criteria,
      assistant_reply: "I couldn't process that adjustment. Try rephrasing your request.",
    };
  },
);
