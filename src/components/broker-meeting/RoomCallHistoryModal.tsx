import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchCallSummariesForRoom } from "@/services/call-summaries";
import type { CallSummaryRecord } from "@/types/call-summary";
import type { BrokerRoom } from "@/types/meeting";
import { roomIdFromName } from "@/types/call-summary";

interface RoomCallHistoryModalProps {
  room: BrokerRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 1) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function summaryPreview(markdown: string, max = 220): string {
  const plain = markdown
    .replace(/^#+\s/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (!plain) return "No executive summary recorded.";
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

function HistoryItem({ record }: { record: CallSummaryRecord }) {
  const [expanded, setExpanded] = useState(false);
  const transcript = record.full_transcript?.trim() || "(No transcript captured.)";

  return (
    <article className="rounded-xl border border-border bg-[#121824] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{formatDate(record.created_at)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Duration {formatDuration(record.duration_seconds)}
          </p>
        </div>
        {record.extracted_tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {record.extracted_tickers.map((ticker) => (
              <Badge
                key={ticker}
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              >
                ${ticker.replace(/^\$/, "")}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {summaryPreview(record.summary_markdown)}
      </p>

      <Button
        variant="ghost"
        size="sm"
        className="mt-3 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <>
            <ChevronUp className="mr-1 h-3.5 w-3.5" /> Hide full transcript
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-3.5 w-3.5" /> View full transcript
          </>
        )}
      </Button>

      {expanded && (
        <div
          className={cn(
            "custom-scrollbar mt-3 max-h-48 overflow-y-auto rounded-lg border border-border/60",
            "bg-slate-900/50 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap",
          )}
        >
          {transcript}
        </div>
      )}
    </article>
  );
}

export function RoomCallHistoryModal({ room, open, onOpenChange }: RoomCallHistoryModalProps) {
  const [records, setRecords] = useState<CallSummaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!room) return;
    setIsLoading(true);
    try {
      const data = await fetchCallSummariesForRoom(roomIdFromName(room.room));
      setRecords(data);
    } finally {
      setIsLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (open && room) void loadHistory();
  }, [open, room, loadHistory]);

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <DialogTitle className="font-display">Call history</DialogTitle>
          </div>
          <DialogDescription>
            {room.room} · {room.broker}
          </DialogDescription>
        </DialogHeader>

        <div className="custom-scrollbar max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading call history…</p>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-[#121824] px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No calls logged yet for this room.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Start a video call — summaries save automatically when you end the session.
              </p>
            </div>
          ) : (
            records.map((record) => <HistoryItem key={record.id} record={record} />)
          )}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
