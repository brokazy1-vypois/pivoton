import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/server-env";
import type { ConvertGoalAiResult, ConvertHopePostToGoalInput } from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

function parseGoalJson(text: string): ConvertGoalAiResult | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as ConvertGoalAiResult;
    if (!parsed.big_goal_title || !Array.isArray(parsed.milestones)) return null;
    const milestones = parsed.milestones.filter((item) => typeof item === "string" && item.trim());
    if (milestones.length === 0) return null;
    return {
      big_goal_title: parsed.big_goal_title.trim(),
      milestones: milestones.slice(0, 5),
      next_action_instruction:
        parsed.next_action_instruction?.trim() ||
        `Start with: ${milestones[0]}`,
    };
  } catch {
    return null;
  }
}

function buildFallbackGoal(post: HopePost, productNames: string[]): ConvertGoalAiResult {
  const snippet = post.content.trim().slice(0, 80) || "Personal hope";
  const productHint = productNames.length
    ? ` Related products: ${productNames.slice(0, 3).join(", ")}.`
    : "";

  return {
    big_goal_title: snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet,
    milestones: [
      "Clarify what success looks like in one sentence",
      "Break the hope into a 2-week action plan",
      "Complete the first concrete step this week",
      "Review progress and adjust the plan",
    ],
    next_action_instruction: `Write down one measurable outcome for "${snippet}".${productHint}`,
  };
}

export const convertHopePostToGoalServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<ConvertGoalAiResult> => {
    const data = extractData(ctx);
    const post = data.post as HopePost;
    const attachedProductNames = (data.attachedProductNames as string[]) ?? [];

    if (!post?.content) {
      throw new Error("Hope post content is required.");
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return buildFallbackGoal(post, attachedProductNames);
    }

    const mediaSummary =
      post.attachments?.length || post.image_urls?.length
        ? `Media attached: ${post.attachments?.length ?? post.image_urls?.length ?? 0} file(s).`
        : "No media attached.";

    const productSummary = attachedProductNames.length
      ? `Attached products: ${attachedProductNames.join(", ")}.`
      : "No marketplace products attached.";

    const prompt = `You are a personal goal coach for a social hope-sharing app called Pivoton.

A user wants to convert their "hope" post into an actionable goal with milestones.

Return ONLY valid JSON matching this schema:
{
  "big_goal_title": "concise goal title (max 12 words)",
  "milestones": ["minor step 1", "minor step 2", "minor step 3", "minor step 4"],
  "next_action_instruction": "1-2 sentences telling the user the immediate next minor task"
}

Hope post content:
${post.content}

${mediaSummary}
${productSummary}
Author role: ${post.job_role ?? "member"}

Rules:
- milestones must be 3-5 practical, ordered minor steps toward the big goal
- next_action_instruction must be specific and actionable today
- keep tone encouraging and concise`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const parsed = parseGoalJson(response.text ?? "");
      if (parsed) return parsed;
    } catch {
      // Fall through to deterministic copy.
    }

    return buildFallbackGoal(post, attachedProductNames);
  },
);
