import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiRecommendationCard } from "@/components/ideation/ApiRecommendationCard";
import { GeminiKeyPanel } from "@/components/ideation/GeminiKeyPanel";
import type { IdeationLoadingPhase } from "@/hooks/useIdeationSession";
import type { IdeationMessage } from "@/types/ideation";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Build a SaaS landing page with auth and Stripe checkout",
  "Create a map-based delivery tracker MVP",
  "Scaffold a fintech wallet with Plaid bank linking",
  "Build an AI chat app with OpenAI integration",
] as const;

interface IdeationChatPanelProps {
  messages: IdeationMessage[];
  envVars: Record<string, string>;
  connectedApiIds?: string[];
  isApiConnected?: boolean;
  isLoading: boolean;
  loadingPhase?: IdeationLoadingPhase;
  onSend: (prompt: string) => void;
  onEnvVarChange: (key: string, value: string) => void;
  onApplyAndGenerate?: (apiId: string) => void;
  onRegeneratePreview?: () => void;
}

function TypingIndicator({ loadingPhase }: { loadingPhase: IdeationLoadingPhase }) {
  const message =
    loadingPhase === "wiring"
      ? "Wiring Supabase keys and scaffolding prototype…"
      : "Ideation agent is building your prototype…";

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500/60 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
      </span>
      {message}
    </div>
  );
}

export function IdeationChatPanel({
  messages,
  envVars,
  connectedApiIds = [],
  isApiConnected = false,
  isLoading,
  loadingPhase = "idle",
  onSend,
  onEnvVarChange,
  onApplyAndGenerate,
  onRegeneratePreview,
}: IdeationChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const latestScaffoldMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && msg.recommendedApiIds?.length && !msg.skipApiCards) {
        return msg.id;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col rounded-xl border border-slate-700/80 bg-[#1e293b]">
      <div className="border-b border-slate-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Ideation agent</span>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
            Gemini
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-cyan-600/20 text-slate-100"
                  : "border border-slate-700/60 bg-slate-900/60 text-slate-300",
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.recommendedApiIds &&
                msg.recommendedApiIds.length > 0 &&
                !msg.skipApiCards &&
                msg.id === latestScaffoldMessageId &&
                !isApiConnected && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      Recommended APIs
                    </p>
                    {msg.recommendedApiIds.map((apiId) => (
                      <ApiRecommendationCard
                        key={apiId}
                        apiId={apiId}
                        envVars={envVars}
                        onEnvVarChange={onEnvVarChange}
                        onApplyAndGenerate={onApplyAndGenerate}
                        isGenerating={isLoading && loadingPhase === "wiring"}
                        isConnected={connectedApiIds.includes(apiId)}
                      />
                    ))}
                  </div>
                )}

              {isApiConnected && connectedApiIds.length > 0 && msg.id === messages.at(-1)?.id && (
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-500/80">
                    Active integrations
                  </p>
                  {connectedApiIds.map((apiId) => (
                    <ApiRecommendationCard
                      key={apiId}
                      apiId={apiId}
                      envVars={envVars}
                      onEnvVarChange={onEnvVarChange}
                      isConnected
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3">
              <TypingIndicator loadingPhase={loadingPhase} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/60 p-4">
        <div className="mb-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Agent settings
          </p>
          <GeminiKeyPanel
            envVars={envVars}
            onEnvVarChange={onEnvVarChange}
            onRegenerate={onRegeneratePreview}
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isLoading}
              onClick={() => onSend(prompt)}
              className="rounded-full border border-slate-600/80 bg-slate-900/50 px-3 py-1 text-[11px] text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
            >
              {prompt.length > 42 ? `${prompt.slice(0, 40)}…` : prompt}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your MVP idea…"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
          />
          <Button
            size="icon"
            disabled={!input.trim() || isLoading}
            onClick={handleSubmit}
            className="h-auto shrink-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
