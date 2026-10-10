import { useState } from "react";
import { FileText, Film, Loader2, X } from "lucide-react";
import { HoverMagnifierThumbnail } from "@/components/hope-feed/ImageCursorMagnifier";
import { cn } from "@/lib/utils";
import type { HopeAttachmentFileType } from "@/types/hope-post";

export interface AttachmentPreviewItem {
  id: string;
  file_name: string;
  file_type: HopeAttachmentFileType;
  previewUrl?: string;
  status: "uploading" | "ready" | "error";
  error?: string;
}

interface AttachmentPreviewRowProps {
  items: AttachmentPreviewItem[];
  onRemove: (id: string) => void;
}

function PreviewBody({ item }: { item: AttachmentPreviewItem }) {
  if (item.status === "uploading") {
    return (
      <span className="grid h-full w-full place-items-center bg-surface-2/80">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </span>
    );
  }

  if (item.status === "error") {
    return (
      <span className="grid h-full w-full place-items-center bg-bear/10 px-1 text-center text-[9px] text-bear">
        Failed
      </span>
    );
  }

  if (item.file_type === "video" && item.previewUrl) {
    return (
      <span className="relative grid h-full w-full place-items-center bg-surface-2">
        <video src={item.previewUrl} muted className="h-full w-full object-cover" />
        <Film className="absolute h-4 w-4 text-white drop-shadow" />
      </span>
    );
  }

  const ext = item.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-surface-2 px-1 text-center">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="line-clamp-1 text-[8px] font-medium uppercase text-muted-foreground">{ext}</span>
    </span>
  );
}

export function AttachmentPreviewRow({ items, onRemove }: AttachmentPreviewRowProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1 pt-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "group relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md border border-border/60",
            item.status === "error" && "border-bear/40",
            activeId === item.id && item.file_type === "image" && "ring-2 ring-primary/40",
          )}
          title={item.error ?? item.file_name}
        >
          {item.status === "ready" && item.file_type === "image" && item.previewUrl ? (
            <HoverMagnifierThumbnail
              src={item.previewUrl}
              alt={item.file_name}
              size={52}
              className="h-full w-full rounded-none border-0"
              isActive={activeId === item.id}
              onPreviewChange={(preview) => setActiveId(preview ? item.id : null)}
            />
          ) : (
            <PreviewBody item={item} />
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className={cn(
              "absolute -right-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full border border-border bg-[#0B132B] text-muted-foreground transition-opacity",
              item.status === "ready"
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-100",
            )}
            aria-label={`Remove ${item.file_name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
