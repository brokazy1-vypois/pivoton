import { useEffect, useRef, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { extractFinancialInsights } from "@/lib/financial-extraction";
import type { FinancialInsight, TranscriptEntry } from "@/types/meeting";
import { cn } from "@/lib/utils";

interface FinancialNotesPanelProps {
  entries: TranscriptEntry[];
  fullTranscript: string;
  isListening: boolean;
  transcriptionError?: string | null;
  onInsightsChange?: (insights: FinancialInsight[]) => void;
}

function FinancialBadge({
  insight,
}: {
  insight: FinancialInsight;
}) {
  const actionColor =
    insight.action === "buy"
      ? "border-bull/40 bg-bull/10 text-bull"
      : insight.action === "sell"
        ? "border-bear/40 bg-bear/10 text-bear"
        : "border-gold/40 bg-gold/10 text-gold";

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", actionColor)}>
      <div className="flex flex-wrap items-center gap-2">
        {insight.ticker && (
          <span className="font-display text-sm font-bold">${insight.ticker}</span>
        )}
        {insight.action && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {insight.action}
          </span>
        )}
        {insight.sentiment && (
          <span className="text-[10px] uppercase tracking-wider opacity-70">{insight.sentiment}</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {insight.entryPrice && <span>Entry: {insight.entryPrice}</span>}
        {insight.targetPrice && <span>Target: {insight.targetPrice}</span>}
        {insight.stopLoss && <span>Stop: {insight.stopLoss}</span>}
        {insight.orderType && (
          <span className="capitalize">{insight.orderType} order</span>
        )}
      </div>
      {insight.insight && (
        <p className="mt-1.5 text-xs leading-relaxed opacity-90">{insight.insight}</p>
      )}
    </div>
  );
}

export function FinancialNotesPanel({
  entries,
  fullTranscript,
  isListening,
  transcriptionError,
  onInsightsChange,
}: FinancialNotesPanelProps) {
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const lastExtractedRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }, [entries]);

  useEffect(() => {
    if (!fullTranscript || fullTranscript.length < 30) return;
    if (fullTranscript === lastExtractedRef.current) return;

    const chunk = fullTranscript.slice(-800);
    if (chunk.length < 30) return;

    const timer = setTimeout(async () => {
      setIsExtracting(true);
      try {
        const extracted = await extractFinancialInsights(chunk);
        if (extracted.length > 0) {
          setInsights((prev) => {
            const merged = [...prev];
            for (const item of extracted) {
              const exists = merged.some(
                (m) =>
                  m.ticker === item.ticker &&
                  m.action === item.action &&
                  m.targetPrice === item.targetPrice,
              );
              if (!exists) merged.unshift(item);
            }
            return merged.slice(0, 12);
          });
        }
        lastExtractedRef.current = fullTranscript;
      } catch {
        // Silent fail — extraction is best-effort during live call
      } finally {
        setIsExtracting(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [fullTranscript]);

  useEffect(() => {
    onInsightsChange?.(insights);
  }, [insights, onInsightsChange]);

  const handleCopyNotes = async () => {
    const notes = [
      "=== AI Financial Notes ===",
      "",
      ...insights.map(
        (i) =>
          `${i.ticker ? `$${i.ticker} ` : ""}${i.action?.toUpperCase() ?? ""} ${i.entryPrice ? `Entry: ${i.entryPrice}` : ""} ${i.targetPrice ? `Target: ${i.targetPrice}` : ""} ${i.insight ?? ""}`.trim(),
      ),
      "",
      "=== Transcript ===",
      fullTranscript,
    ].join("\n");

    await navigator.clipboard.writeText(notes);
    toast.success("Notes copied to clipboard");
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">AI Smart Financial Notes</h3>
          {isListening && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Live
            </span>
          )}
        </div>
        {transcriptionError && (
          <p className="mt-2 text-xs text-destructive">{transcriptionError}</p>
        )}
      </div>

      <div className="border-b border-border p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Highlighted metrics
          {isExtracting && <span className="ml-2 text-primary">· analyzing…</span>}
        </p>
        <div className="grid max-h-48 gap-2 overflow-y-auto">
          {insights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Financial metrics will appear here as the call progresses…
            </p>
          ) : (
            insights.map((insight) => (
              <FinancialBadge key={insight.id} insight={insight} />
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Live transcript
        </p>
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          <div className="space-y-2 pb-4">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Waiting for speech…
              </p>
            ) : (
              entries.map((entry) => (
                <p
                  key={entry.id}
                  className={cn(
                    "text-sm leading-relaxed",
                    entry.isFinal ? "text-foreground" : "text-muted-foreground italic",
                  )}
                >
                  {entry.text}
                </p>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void handleCopyNotes()}
          disabled={!fullTranscript && insights.length === 0}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy Notes
        </Button>
      </div>
    </div>
  );
}
