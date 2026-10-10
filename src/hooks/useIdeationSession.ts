import { useCallback, useEffect, useMemo, useState } from "react";
import { ideationChatServer } from "@/lib/ideation-agent.server";
import {
  getConfiguredApiIds,
  isApiFullyConfigured,
  loadConnectedApiIds,
  loadEnvVars,
  persistConnectedApiIds,
  persistEnvVars,
  syncConnectedApiIds,
} from "@/lib/ideation-env-state";
import { getApiById } from "@/data/ideation-api-catalog";
import {
  hasGeminiKeyConfigured,
  readViteGeminiKey,
  resolveClientGeminiKey,
  resolveGeminiKeyFromStorage,
  stripGeminiKeys,
} from "@/lib/gemini-key";
import {
  buildCodeBundleFromHtml,
  ensurePrototypeHtml,
  filterPublicEnvVars,
} from "@/lib/prototype-sandbox";
import {
  derivePrototypeMetadata,
  publishIdeationPrototype,
  saveIdeationPrototype,
} from "@/services/ideation-prototypes";
import type { IdeationCodeBundle, IdeationMessage, IdeationPrototype } from "@/types/ideation";

export type IdeationLoadingPhase = "idle" | "chat" | "wiring";

function getLastMvpPrompt(messages: IdeationMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" && !msg.content.startsWith("[Apply keys]")) {
      return msg.content;
    }
  }
  return "";
}

function createMessage(
  role: IdeationMessage["role"],
  content: string,
  options?: { recommendedApiIds?: string[]; skipApiCards?: boolean },
): IdeationMessage {
  const skipApiCards = options?.skipApiCards ?? false;
  const recommendedApiIds =
    skipApiCards || !options?.recommendedApiIds?.length ? undefined : options.recommendedApiIds;

  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...(recommendedApiIds?.length ? { recommendedApiIds } : {}),
    ...(skipApiCards ? { skipApiCards: true } : {}),
  };
}

interface UseIdeationSessionOptions {
  userId?: string | null;
  userName?: string;
  userAvatar?: string;
}

export function useIdeationSession(options: UseIdeationSessionOptions = {}) {
  const { userId, userName, userAvatar } = options;

  const [messages, setMessages] = useState<IdeationMessage[]>([
    createMessage(
      "assistant",
      "Welcome to **Ideation Studio**. Describe the web app you want to build — I'll scaffold a live preview, recommend APIs, and help you wire up keys.",
    ),
  ]);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [connectedApiIds, setConnectedApiIds] = useState<string[]>([]);
  const [prototypeHtml, setPrototypeHtml] = useState("");
  const [codeBundle, setCodeBundle] = useState<IdeationCodeBundle | null>(null);
  const [savedPrototypeId, setSavedPrototypeId] = useState<string | null>(null);
  const [savedPrototype, setSavedPrototype] = useState<IdeationPrototype | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<IdeationLoadingPhase>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationWarning, setGenerationWarning] = useState<string | null>(null);

  useEffect(() => {
    const storedEnv = loadEnvVars();
    const viteGemini = readViteGeminiKey();
    if (viteGemini && !resolveGeminiKeyFromStorage(storedEnv)) {
      storedEnv.GEMINI_API_KEY = viteGemini;
      persistEnvVars(storedEnv);
    }
    const storedConnected = syncConnectedApiIds(loadConnectedApiIds(), storedEnv);
    setEnvVars(storedEnv);
    setConnectedApiIds(storedConnected);
    if (storedConnected.length !== loadConnectedApiIds().length) {
      persistConnectedApiIds(storedConnected);
    }
  }, []);

  const metadata = useMemo(
    () => derivePrototypeMetadata(messages, prototypeHtml),
    [messages, prototypeHtml],
  );

  const prototypeEnvVars = useMemo(() => stripGeminiKeys(envVars), [envVars]);

  const activeEnvKeys = useMemo(
    () =>
      Object.entries(prototypeEnvVars)
        .filter(([, value]) => value.trim())
        .map(([key]) => key),
    [prototypeEnvVars],
  );

  const hasGeminiKey = useMemo(() => hasGeminiKeyConfigured(envVars), [envVars]);

  const isApiConnected = connectedApiIds.length > 0;

  const lastRecommendedApiIds = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const ids = messages[i].recommendedApiIds;
      if (ids?.length) return ids;
    }
    return [];
  }, [messages]);

  const canApplyKeys = useMemo(() => {
    if (activeEnvKeys.length === 0) return false;
    if (isApiConnected) return false;
    if (lastRecommendedApiIds.length === 0) return true;
    return lastRecommendedApiIds.some((apiId) => isApiFullyConfigured(apiId, envVars));
  }, [activeEnvKeys.length, envVars, isApiConnected, lastRecommendedApiIds]);

  const canSave = Boolean(
    (prototypeHtml.trim() || (codeBundle && Object.keys(codeBundle.files).length > 0)) &&
      userId &&
      userName,
  );

  const markApisConnected = useCallback((apiIds: string[]) => {
    if (apiIds.length === 0) return;
    setConnectedApiIds((prev) => {
      const next = [...new Set([...prev, ...apiIds])];
      persistConnectedApiIds(next);
      return next;
    });
  }, []);

  const setEnvVar = useCallback((key: string, value: string) => {
    setEnvVars((prev) => {
      const next = { ...prev, [key]: value };
      persistEnvVars(next);

      if (key === "GEMINI_API_KEY" || key === "VITE_GEMINI_API_KEY") {
        if (value.trim()) {
          setGenerationWarning(null);
        }
      }

      if (!value.trim()) {
        const affectedApiIds = getConfiguredApiIds(prev).filter(
          (apiId) => !isApiFullyConfigured(apiId, next),
        );
        if (affectedApiIds.length > 0) {
          setConnectedApiIds((connected) => {
            const synced = connected.filter((id) => !affectedApiIds.includes(id));
            persistConnectedApiIds(synced);
            return synced;
          });
        }
      }

      return next;
    });
  }, []);

  const clearEnvVar = useCallback((key: string) => {
    setEnvVars((prev) => {
      const next = { ...prev };
      delete next[key];
      persistEnvVars(next);

      setConnectedApiIds((connected) => {
        const synced = syncConnectedApiIds(connected, next);
        persistConnectedApiIds(synced);
        return synced;
      });

      return next;
    });
  }, []);

  const invokeAgent = useCallback(
    async (params: {
      prompt: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      mode?: "chat" | "wire_keys";
      originalPrompt?: string;
      connectedIds: string[];
      skipApiCards?: boolean;
    }) => {
      const { prompt, history, mode = "chat", originalPrompt, connectedIds, skipApiCards } = params;
      const apiConnected = connectedIds.length > 0;
      const effectiveMode = apiConnected || mode === "wire_keys" ? "wire_keys" : "chat";

      const geminiApiKey = resolveClientGeminiKey(envVars);

      const result = await ideationChatServer({
        data: {
          prompt,
          history,
          activeEnvKeys,
          envVars: prototypeEnvVars,
          geminiApiKey,
          mode: effectiveMode,
          originalPrompt: originalPrompt ?? prompt,
          isApiConnected: apiConnected,
          connectedApiIds: connectedIds,
        },
      });

      const html = ensurePrototypeHtml(result.htmlPreview, {
        fallbackPrompt: originalPrompt ?? prompt,
        envVars: prototypeEnvVars,
        wired: apiConnected || effectiveMode === "wire_keys",
      });
      const bundle = buildCodeBundleFromHtml(html);

      setPrototypeHtml(html);
      setCodeBundle(bundle);
      setGenerationWarning(
        result.generationSource === "gemini" || (hasGeminiKeyConfigured(envVars) && !result.generationWarning)
          ? null
          : (result.generationWarning ?? null),
      );

      const shouldSkipCards = skipApiCards ?? (apiConnected || effectiveMode === "wire_keys");

      setMessages((prev) => [
        ...prev,
        createMessage("assistant", result.assistantReply, {
          recommendedApiIds: shouldSkipCards ? undefined : result.recommendedApiIds,
          skipApiCards: shouldSkipCards,
        }),
      ]);

      return result;
    },
    [activeEnvKeys, envVars, prototypeEnvVars],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setIsLoading(true);
      setLoadingPhase(isApiConnected ? "wiring" : "chat");

      const userMessage = createMessage("user", trimmed);
      setMessages((prev) => [...prev, userMessage]);

      const history = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const keysReady = lastRecommendedApiIds.some((apiId) =>
        isApiFullyConfigured(apiId, envVars),
      );
      const shouldWire = isApiConnected || keysReady;
      let nextConnectedIds = connectedApiIds;

      if (shouldWire && !isApiConnected && keysReady) {
        const newlyConnected = lastRecommendedApiIds.filter((apiId) =>
          isApiFullyConfigured(apiId, envVars),
        );
        markApisConnected(newlyConnected);
        nextConnectedIds = [...new Set([...connectedApiIds, ...newlyConnected])];
      }

      try {
        await invokeAgent({
          prompt: trimmed,
          history,
          mode: shouldWire ? "wire_keys" : "chat",
          originalPrompt: shouldWire ? getLastMvpPrompt([...messages, userMessage]) || trimmed : trimmed,
          connectedIds: nextConnectedIds,
          skipApiCards: shouldWire,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not reach the Ideation agent.";
        setError(message);
        setMessages((prev) => [
          ...prev,
          createMessage(
            "assistant",
            `Something went wrong: ${message}. Try again or check your Gemini API key.`,
            { skipApiCards: true },
          ),
        ]);
      } finally {
        setIsLoading(false);
        setLoadingPhase("idle");
      }
    },
    [
      connectedApiIds,
      envVars,
      invokeAgent,
      isApiConnected,
      isLoading,
      lastRecommendedApiIds,
      markApisConnected,
      messages,
    ],
  );

  const regeneratePreview = useCallback(async () => {
    const lastPrompt = getLastMvpPrompt(messages);
    if (!lastPrompt || isLoading) return;
    if (!hasGeminiKeyConfigured(envVars)) {
      setError("Add your Gemini API key in Agent settings first.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingPhase(isApiConnected ? "wiring" : "chat");

    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      await invokeAgent({
        prompt: lastPrompt,
        history,
        mode: isApiConnected ? "wire_keys" : "chat",
        originalPrompt: lastPrompt,
        connectedIds: connectedApiIds,
        skipApiCards: isApiConnected,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not regenerate preview.";
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingPhase("idle");
    }
  }, [connectedApiIds, envVars, invokeAgent, isApiConnected, isLoading, messages]);

  const applyKeysAndGenerate = useCallback(
    async (apiId?: string) => {
      if (isLoading) return;

      const originalPrompt = getLastMvpPrompt(messages);
      if (!originalPrompt) {
        setError("Describe your MVP idea first, then apply your API keys.");
        return;
      }

      const targetApi = apiId ? getApiById(apiId) : null;
      if (apiId && targetApi && !isApiFullyConfigured(apiId, envVars)) {
        setError(`Complete all ${targetApi.name} environment variables before generating.`);
        return;
      }

      if (!canApplyKeys && !isApiConnected) {
        setError("Fill in the required API credentials before generating deliverables.");
        return;
      }

      setError(null);
      setIsLoading(true);
      setLoadingPhase("wiring");

      const apiLabel = targetApi?.name ?? "configured APIs";
      const wirePrompt = `Wire ${apiLabel} using my configured environment variables and generate the full interactive prototype deliverable. Use window.__PIVOTON_ENV__ for all credentials in the HTML/JS. Include database schema SQL in your reply and upgrade the preview with real integration hooks and polished UI.`;

      const userMessage = createMessage("user", `[Apply keys] ${wirePrompt}`);
      setMessages((prev) => [...prev, userMessage]);

      const history = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const apisToConnect = apiId
        ? [apiId]
        : lastRecommendedApiIds.filter((id) => isApiFullyConfigured(id, envVars));
      markApisConnected(apisToConnect);
      const nextConnectedIds = [...new Set([...connectedApiIds, ...apisToConnect])];

      try {
        await invokeAgent({
          prompt: wirePrompt,
          history,
          mode: "wire_keys",
          originalPrompt,
          connectedIds: nextConnectedIds,
          skipApiCards: true,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not generate deliverables with your API keys.";
        setError(message);
        setMessages((prev) => [
          ...prev,
          createMessage(
            "assistant",
            `Something went wrong while wiring your keys: ${message}. Check your credentials and try again.`,
            { skipApiCards: true },
          ),
        ]);
      } finally {
        setIsLoading(false);
        setLoadingPhase("idle");
      }
    },
    [
      canApplyKeys,
      connectedApiIds,
      envVars,
      invokeAgent,
      isApiConnected,
      isLoading,
      lastRecommendedApiIds,
      markApisConnected,
      messages,
    ],
  );

  const savePrototype = useCallback(async (): Promise<IdeationPrototype | null> => {
    if (!canSave || !userId || !userName) return null;

    setIsSaving(true);
    setError(null);
    try {
      const bundle =
        codeBundle && Object.keys(codeBundle.files).length > 0
          ? codeBundle
          : buildCodeBundleFromHtml(prototypeHtml);

      const saved = await saveIdeationPrototype({
        id: savedPrototypeId ?? undefined,
        user_id: userId,
        author_name: userName,
        author_avatar: userAvatar ?? null,
        title: metadata.title,
        description: metadata.description,
        html_preview: prototypeHtml,
        code_bundle: bundle,
        env_vars: prototypeEnvVars,
        recommended_api_ids: metadata.recommendedApiIds,
        messages,
      });
      setSavedPrototypeId(saved.id);
      setSavedPrototype(saved);
      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save prototype.";
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    metadata,
    messages,
    codeBundle,
    envVars,
    prototypeEnvVars,
    prototypeHtml,
    savedPrototypeId,
    userAvatar,
    userId,
    userName,
  ]);

  const sharePrototype = useCallback(
    async (title: string, description: string): Promise<IdeationPrototype | null> => {
      if (!userId || !userName) return null;

      setIsPublishing(true);
      setError(null);
      try {
        let saved = savedPrototype;
        if (!saved) saved = await savePrototype();
        if (!saved) throw new Error("Save the prototype before sharing.");

        const bundle =
          codeBundle && Object.keys(codeBundle.files).length > 0
            ? codeBundle
            : buildCodeBundleFromHtml(prototypeHtml);

        const published = await publishIdeationPrototype({
          id: saved.id,
          title,
          description,
          code_bundle: bundle,
          env_vars: filterPublicEnvVars(prototypeEnvVars),
          monetization_tier: "active",
        });
        setSavedPrototype(published);
        return published;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not publish prototype.";
        setError(message);
        throw err;
      } finally {
        setIsPublishing(false);
      }
    },
    [codeBundle, prototypeEnvVars, prototypeHtml, savePrototype, savedPrototype, userId, userName],
  );

  const deployToFeed = useCallback(
    async (title: string, description: string): Promise<IdeationPrototype | null> => {
      return sharePrototype(title, description);
    },
    [sharePrototype],
  );

  const resetSession = useCallback(() => {
    setMessages([
      createMessage(
        "assistant",
        "Session reset. Describe your next MVP idea and I'll scaffold it for you.",
      ),
    ]);
    setPrototypeHtml("");
    setCodeBundle(null);
    setSavedPrototypeId(null);
    setSavedPrototype(null);
    setConnectedApiIds([]);
    persistConnectedApiIds([]);
    setError(null);
    setGenerationWarning(null);
  }, []);

  return {
    messages,
    envVars,
    prototypeEnvVars,
    prototypeHtml,
    codeBundle,
    metadata,
    hasGeminiKey,
    savedPrototypeId,
    savedPrototype,
    isLoading,
    loadingPhase,
    isSaving,
    isPublishing,
    error,
    generationWarning,
    canSave,
    canApplyKeys,
    isApiConnected,
    connectedApiIds,
    activeEnvKeys,
    setEnvVar,
    clearEnvVar,
    sendMessage,
    applyKeysAndGenerate,
    regeneratePreview,
    savePrototype,
    sharePrototype,
    deployToFeed,
    resetSession,
  };
}
