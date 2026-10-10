import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/server-env";
import type { VerifyStepProofResult } from "@/types/hope-goal";

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

function parseVerifyJson(text: string): VerifyStepProofResult | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as VerifyStepProofResult;
    if (typeof parsed.verified !== "boolean") return null;
    return {
      verified: parsed.verified,
      summary: String(parsed.summary ?? "").trim() || "Verification complete.",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
    };
  } catch {
    return null;
  }
}

/** Gemini Vision proof verification for a goal step (TanStack server fn). */
export const verifyGoalStepProofServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<VerifyStepProofResult> => {
    const data = extractData(ctx);
    const stepTitle = String(data.stepTitle ?? "");
    const criteria = String(data.criteria ?? stepTitle);
    const proofBase64 = String(data.proofBase64 ?? "");
    const mimeType = String(data.mimeType ?? "image/jpeg");

    if (!stepTitle || !proofBase64) {
      throw new Error("Step title and proof image are required.");
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return {
        verified: true,
        summary: "Proof accepted (Gemini not configured — auto-approved for demo).",
        confidence: 0.6,
      };
    }

    const prompt = `You are an objective goal-step verifier for Pivoton.

Evaluate whether the uploaded proof image shows meaningful progress on this step.

Step title: ${stepTitle}
Success criteria: ${criteria}

Return ONLY valid JSON:
{
  "verified": true or false,
  "summary": "1-2 sentence explanation of what you see and why it passes or fails",
  "confidence": 0.0 to 1.0
}

Be fair but strict: the image must reasonably demonstrate the step was executed.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: proofBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseVerifyJson(response.text ?? "");
    if (parsed) return parsed;

    return {
      verified: false,
      summary: "Could not parse verification response. Please try another image.",
      confidence: 0,
    };
  },
);
