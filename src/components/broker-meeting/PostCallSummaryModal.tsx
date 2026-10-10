import { Loader2, TrendingUp, ListChecks, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MeetingSummary } from "@/types/meeting";

interface PostCallSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summary: MeetingSummary | null;
  isLoading: boolean;
  savedToHistory?: boolean;
}

export function PostCallSummaryModal({
  open,
  onClose,
  summary,
  isLoading,
  savedToHistory = false,
}: PostCallSummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Post-Meeting Executive Summary</DialogTitle>
          <DialogDescription>
            AI-generated recap of your broker consultancy session
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating executive summary…</p>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            <section>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {summary.executiveSummary}
              </p>
            </section>

            {summary.tickers.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-semibold">Key Tickers Discussed</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.tickers.map((ticker) => (
                    <Badge
                      key={ticker}
                      variant="outline"
                      className="border-gold/40 bg-gold/10 text-gold"
                    >
                      ${ticker.replace(/^\$/, "")}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {summary.recommendations.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Trade Recommendations & Levels</h3>
                </div>
                <div className="space-y-2">
                  {summary.recommendations.map((rec, i) => (
                    <div
                      key={`${rec.ticker}-${i}`}
                      className="rounded-lg border border-border bg-surface px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-gold">
                          ${rec.ticker.replace(/^\$/, "")}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            rec.action.toLowerCase().includes("buy")
                              ? "border-bull/40 text-bull"
                              : rec.action.toLowerCase().includes("sell")
                                ? "border-bear/40 text-bear"
                                : ""
                          }
                        >
                          {rec.action}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                        {rec.entry && <span>Entry: {rec.entry}</span>}
                        {rec.target && <span>Target: {rec.target}</span>}
                        {rec.stop && <span>Stop: {rec.stop}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {summary.actionItems.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Action Items & Next Steps</h3>
                </div>
                <ul className="space-y-1.5">
                  {summary.actionItems.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No summary available.
          </p>
        )}

        {savedToHistory && !isLoading && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            Summary saved to Private Room history
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
