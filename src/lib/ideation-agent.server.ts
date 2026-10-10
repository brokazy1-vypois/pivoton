import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { IDEATION_API_CATALOG, recommendApisFromText } from "@/data/ideation-api-catalog";
import { getGeminiApiKey } from "@/lib/server-env";
import { ensurePrototypeHtml, isValidRunnableHtml } from "@/lib/prototype-sandbox";
import type { IdeationAgentResponse, IdeationChatRequest } from "@/types/ideation";

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

function parseAgentJson(text: string): IdeationAgentResponse | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      assistant_reply?: string;
      html_preview?: string;
      recommended_api_ids?: string[];
    };

    if (!parsed.assistant_reply?.trim()) return null;

    const validIds = new Set(IDEATION_API_CATALOG.map((api) => api.id));
    const recommendedApiIds = (parsed.recommended_api_ids ?? []).filter((id) =>
      validIds.has(id),
    );

    return {
      assistantReply: parsed.assistant_reply.trim(),
      htmlPreview: parsed.html_preview?.trim() ?? "",
      recommendedApiIds,
    };
  } catch {
    return null;
  }
}

function formatEnvContext(envVars: Record<string, string> | undefined): string {
  if (!envVars) return "";
  const entries = Object.entries(envVars).filter(([, value]) => value.trim());
  if (entries.length === 0) return "";

  const lines = entries.map(([key, value]) => {
    const isSecret = /SECRET|KEY|TOKEN|PASSWORD/i.test(key);
    return `- ${key}: ${isSecret ? "[configured — use window.__PIVOTON_ENV__." + key + " in generated code]" : value}`;
  });

  return `\nConfigured environment variables:\n${lines.join("\n")}`;
}

function finalizeHtmlPreview(
  html: string,
  request: IdeationChatRequest,
  apiIds: string[],
): string {
  const basePrompt = request.originalPrompt ?? request.prompt;
  const wired = request.mode === "wire_keys" || request.isApiConnected;

  return ensurePrototypeHtml(html, {
    fallbackPrompt: basePrompt,
    envVars: request.envVars,
    wired,
  });
}

function stripApiRecommendations(
  response: IdeationAgentResponse,
  request: IdeationChatRequest,
): IdeationAgentResponse {
  if (request.isApiConnected || request.mode === "wire_keys") {
    return { ...response, recommendedApiIds: [] };
  }
  return response;
}

function resolveRequestGeminiKey(request: IdeationChatRequest): string {
  const fromRequest = request.geminiApiKey?.trim();
  if (fromRequest) return fromRequest;
  return getGeminiApiKey();
}

function buildFallbackResponse(request: IdeationChatRequest): IdeationAgentResponse {
  const basePrompt = request.originalPrompt ?? request.prompt;
  const recommendedApiIds = recommendApisFromText(basePrompt);
  const apiNames = recommendedApiIds
    .map((id) => IDEATION_API_CATALOG.find((api) => api.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const hasEnvVars = request.envVars && Object.keys(request.envVars).length > 0;
  const isWired = request.mode === "wire_keys" || request.isApiConnected;

  if (isWired && hasEnvVars) {
    const connectedNames =
      request.connectedApiIds
        ?.map((id) => IDEATION_API_CATALOG.find((api) => api.id === id)?.name)
        .filter(Boolean)
        .join(", ") || apiNames || "Supabase";

    return stripApiRecommendations(
      {
        assistantReply: `${connectedNames} is connected. I've scaffolded an interactive deliverable for: "${basePrompt.slice(0, 120)}${basePrompt.length > 120 ? "…" : ""}".\n\n**Deliverables:**\n- Live preview updated on the right\n- SQL schema included below — run it in your Supabase SQL editor\n- Auth and data flows are wired via \`window.__PIVOTON_ENV__\`\n\n**Next steps:** Save or share when you're ready, or ask me to refine the UI.`,
        htmlPreview: finalizeHtmlPreview("", request, recommendedApiIds),
        recommendedApiIds: [],
        generationSource: "local_scaffold",
        generationWarning: resolveRequestGeminiKey(request)
          ? undefined
          : "Add your Gemini API key in Agent settings below for full AI-generated UI.",
      },
      request,
    );
  }

  return {
    assistantReply: `I'll scaffold an MVP for: "${basePrompt.slice(0, 120)}${basePrompt.length > 120 ? "…" : ""}".\n\nRecommended APIs: ${apiNames || "Supabase"}. Paste keys in the API cards below, then click **Apply Keys & Generate Deliverables** to wire them into your prototype.`,
    htmlPreview: finalizeHtmlPreview("", request, recommendedApiIds),
    recommendedApiIds,
    generationSource: "local_scaffold",
    generationWarning: resolveRequestGeminiKey(request)
      ? undefined
      : "Add your Gemini API key in Agent settings below for full AI-generated UI.",
  };
}

function buildSystemPrompt(
  mode: IdeationChatRequest["mode"],
  isApiConnected: boolean,
): string {
  const catalogSummary = IDEATION_API_CATALOG.map(
    (api) =>
      `- ${api.id}: ${api.name} (${api.pricingLabel}) — ${api.description}. Keywords: ${api.keywords.slice(0, 6).join(", ")}`,
  ).join("\n");

  const wireKeysRules =
    mode === "wire_keys" || isApiConnected
      ? `
Wire-keys / connected mode:
- API credentials are ALREADY configured and injected — NEVER ask the user to paste keys again
- Return recommended_api_ids as an empty array []
- Do NOT mention "paste keys", "Get API Key", or credential setup steps
- html_preview MUST read credentials from window.__PIVOTON_ENV__ (never hardcode secrets)
- Include working JS that initializes configured APIs (e.g. supabase.createClient from CDN)
- assistant_reply MUST include a SQL schema section when Supabase is configured
- Build UI flows specific to the original MVP idea — output deliverables, not setup instructions`
      : "";

  return `You are Pivoton Ideation, an AI developer agent that helps users rapidly prototype MVPs.

Available third-party APIs (recommend by id when relevant):
${catalogSummary}

When the user describes an app idea, return ONLY valid JSON:
{
  "assistant_reply": "concise markdown-friendly explanation of the MVP plan, stack (React + Tailwind), and next steps",
  "html_preview": "complete self-contained HTML document using Tailwind CDN. Dark theme (#0f172a bg, #1e293b cards, cyan accents). Must be a working UI mockup reflecting the user's request.",
  "recommended_api_ids": ["supabase", "stripe"]
}

Rules:
- html_preview must be a full <!DOCTYPE html> page with Tailwind CDN script tag
- Use realistic placeholder content matching the user's idea
- recommended_api_ids must only use ids from the catalog above
- Keep assistant_reply under 200 words
- If user asks to iterate, refine html_preview based on conversation context
- When env vars are provided, reference them via window.__PIVOTON_ENV__.KEY_NAME in generated JS
- If isApiConnected is true, skip all credential prompts and generate the app directly${wireKeysRules}`;
}

export const ideationChatServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<IdeationAgentResponse> => {
    const data = extractData(ctx);
    const prompt = String(data.prompt ?? "").trim();
    const history = (data.history as IdeationChatRequest["history"]) ?? [];
    const activeEnvKeys = (data.activeEnvKeys as string[]) ?? [];
    const envVars = (data.envVars as Record<string, string>) ?? {};
    const mode = (data.mode as IdeationChatRequest["mode"]) ?? "chat";
    const originalPrompt = String(data.originalPrompt ?? "").trim() || undefined;
    const isApiConnected = Boolean(data.isApiConnected);
    const connectedApiIds = (data.connectedApiIds as string[]) ?? [];
    const geminiApiKey = String(data.geminiApiKey ?? "").trim() || undefined;

    if (!prompt) {
      throw new Error("Prompt is required.");
    }

    const request: IdeationChatRequest = {
      prompt,
      history,
      activeEnvKeys,
      envVars,
      geminiApiKey,
      mode,
      originalPrompt,
      isApiConnected,
      connectedApiIds,
    };
    const apiKey = resolveRequestGeminiKey(request);

    if (!apiKey) {
      const fallback = buildFallbackResponse(request);
      fallback.htmlPreview = finalizeHtmlPreview(fallback.htmlPreview, request, fallback.recommendedApiIds);
      return fallback;
    }

    const historyBlock = history
      .slice(-6)
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    const envBlock = formatEnvContext(envVars);
    const connectedBlock =
      isApiConnected && connectedApiIds.length > 0
        ? `\nAPIs already connected (do NOT re-prompt for keys): ${connectedApiIds.join(", ")}`
        : "";
    const modeBlock =
      mode === "wire_keys" || isApiConnected
        ? `\nMode: wire_keys — credentials are active. Generate full deliverable immediately. Original MVP idea: ${originalPrompt ?? prompt}${connectedBlock}`
        : activeEnvKeys.length > 0
          ? `\nUser has configured env keys: ${activeEnvKeys.join(", ")}`
          : "";

    const userMessage = `${historyBlock ? `${historyBlock}\n\n` : ""}User: ${prompt}${modeBlock}${envBlock}`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userMessage,
        config: {
          systemInstruction: buildSystemPrompt(mode, isApiConnected),
          responseMimeType: "application/json",
        },
      });

      const parsed = parseAgentJson(response.text ?? "");
      if (parsed) {
        if (parsed.recommendedApiIds.length === 0 && !isApiConnected && mode !== "wire_keys") {
          parsed.recommendedApiIds = recommendApisFromText(originalPrompt ?? prompt);
        }
        const apiIds =
          parsed.recommendedApiIds.length > 0
            ? parsed.recommendedApiIds
            : recommendApisFromText(originalPrompt ?? prompt);
        if (!isValidRunnableHtml(parsed.htmlPreview)) {
          parsed.htmlPreview = finalizeHtmlPreview("", request, apiIds);
          parsed.generationSource = "local_scaffold";
          parsed.generationWarning =
            "Gemini returned an invalid preview — showing a local scaffold instead. Try sending your prompt again.";
        } else {
          parsed.generationSource = "gemini";
        }
        parsed.htmlPreview = finalizeHtmlPreview(parsed.htmlPreview, request, apiIds);
        return stripApiRecommendations(parsed, request);
      }
    } catch (err) {
      console.error("[ideation-agent] Gemini request failed:", err);
    }

    const fallback = buildFallbackResponse(request);
    if (apiKey) {
      fallback.generationWarning =
        "Gemini request failed — showing a local interactive scaffold. Check your API key quota and try again.";
    }
    fallback.htmlPreview = finalizeHtmlPreview(fallback.htmlPreview, request, fallback.recommendedApiIds);
    return fallback;
  },
);
