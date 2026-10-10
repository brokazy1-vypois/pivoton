import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Loader2, Send, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceAgentMessageBody } from "@/components/dashboard/FinanceAgentMessageBody";
import { useFinanceAgent } from "@/context/FinanceAgentContext";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  {
    label: "Analyze Open Positions",
    text: "Analyze my open positions and summarize risk across covered vs uncovered holdings.",
  },
  {
    label: "Hedging Strategy for Banking Swing",
    text: "Should I hedge my regional banking swing position? What strategy fits my current portfolio?",
  },
  {
    label: "Tax Treatment on Realized Gains",
    text: "Explain tax treatment on realized gains from my covered ETF ladder and broker call profits.",
  },
] as const;

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      AI agent analyzing market data…
    </div>
  );
}

function UsageBadge({
  remaining,
  dailyLimit,
  isPremium,
}: {
  remaining: number | null;
  dailyLimit: number;
  isPremium: boolean;
}) {
  if (isPremium) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
        <Crown className="h-3 w-3" />
        Premium · Unlimited AI prompts
      </div>
    );
  }

  const used = dailyLimit - (remaining ?? 0);
  const tone =
    remaining === 0
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : remaining === 1
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium",
        tone,
      )}
    >
      Free Plan: {remaining}/{dailyLimit} daily AI prompts remaining
      {used > 0 && remaining !== null && remaining > 0 && (
        <span className="ml-1 opacity-70">({used} used today)</span>
      )}
    </div>
  );
}

function PremiumUpgradeBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-[#0B0E14] to-red-950/20 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/20 text-gold">
          <Sparkle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Daily AI Limit Reached (3/3 Used)
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Upgrade to Pivoton Premium for $39/month to get unlimited deep portfolio analysis,
            real-time trade hedging advice, and full valuation reports.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={onUpgrade}
            >
              Upgrade to Premium — $39/mo
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/pricing">View plans</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinanceAgentChat() {
  const {
    messages,
    isLoading,
    isVoiceLoading,
    streamingId,
    limitReached,
    remaining,
    dailyLimit,
    isPremium,
    sendFinancePrompt,
    upgradePremium,
  } = useFinanceAgent();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const inputDisabled = isLoading || isVoiceLoading || limitReached;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, streamingId]);

  const sendMessage = async (raw: string) => {
    try {
      await sendFinancePrompt(raw);
    } catch {
      /* toast handled in context */
    }
  };

  return (
    <>
      <div ref={scrollRef} className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={cn(m.role === "user" ? "flex justify-end" : "")}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-lg border border-slate-700/50 bg-slate-900/80 px-4 py-2.5 text-sm text-foreground">
                {m.text}
              </p>
            ) : m.text ? (
              <div className="max-w-[95%]">
                <FinanceAgentMessageBody text={m.text} />
              </div>
            ) : isLoading && m.id === streamingId ? (
              <TypingIndicator />
            ) : null}
          </div>
        ))}
        {isLoading && !streamingId && <TypingIndicator />}
      </div>

      {!limitReached && (
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={inputDisabled}
              onClick={() => void sendMessage(chip.text)}
              className={cn(
                "rounded-full border border-slate-700/50 bg-slate-900/50 px-3 py-1 text-[11px] text-muted-foreground",
                "transition-colors hover:border-emerald-500/40 hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <UsageBadge remaining={remaining} dailyLimit={dailyLimit} isPremium={isPremium} />

        {limitReached ? (
          <PremiumUpgradeBanner onUpgrade={upgradePremium} />
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                  setInput("");
                }
              }}
              disabled={inputDisabled}
              placeholder="Ask about a ticker, a call, or a hedge…"
              className={cn(
                "flex h-10 w-full rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 text-sm",
                "text-foreground placeholder:text-muted-foreground",
                "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />
            <Button
              size="icon"
              disabled={!input.trim() || inputDisabled}
              onClick={() => {
                void sendMessage(input);
                setInput("");
              }}
              aria-label="Send message"
              className="shrink-0 bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
