import { CalendarDays, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HangoutVenue } from "@/types/hangout";

interface MapLocationDetailPanelProps {
  venue: HangoutVenue;
  open: boolean;
  onClose: () => void;
  onHangout: () => void;
  className?: string;
}

export function MapLocationDetailPanel({
  venue,
  open,
  onClose,
  onHangout,
  className,
}: MapLocationDetailPanelProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-30 w-[min(100%,22rem)] overflow-hidden rounded-xl border border-slate-700/80 bg-[#0B1220]/95 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-md",
        className,
      )}
    >
      {venue.photoUrl ? (
        <div className="relative h-32 w-full overflow-hidden bg-slate-900">
          <img src={venue.photoUrl} alt={venue.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary/80">
              {venue.category?.replace(/_/g, " ") ?? "Point of interest"}
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">{venue.name}</h3>
          </div>
          <button
            type="button"
            aria-label="Close location details"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-300">{venue.description}</p>

        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
          <span>{venue.address}</span>
        </p>

        <Button
          type="button"
          className="mt-4 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onHangout}
        >
          <CalendarDays className="h-4 w-4" />
          Hangout
        </Button>
      </div>
    </div>
  );
}
