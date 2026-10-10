import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { resolvePreviewImageUrl } from "@/components/hope-feed/ImageCursorMagnifier";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HopeImageLightboxProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function HopeImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
}: HopeImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(initialIndex);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const goPrevious = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(images.length - 1, current + 1));
  }, [images.length]);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, goNext, goPrevious, open]);

  if (!mounted || images.length === 0) return null;

  const currentUrl = resolvePreviewImageUrl(images[index] ?? images[0]);
  const hasMultiple = images.length > 1;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/90 backdrop-blur-md transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={close}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-medium text-white/90">
          {hasMultiple ? `${index + 1} of ${images.length}` : "1 of 1"}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/90 hover:bg-white/10 hover:text-white"
            onClick={() =>
              void downloadImage(currentUrl, `hope-attachment-${index + 1}.jpg`)
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white/90 hover:bg-white/10 hover:text-white"
            onClick={close}
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className="flex h-full items-center justify-center px-4 pb-6 pt-16 sm:px-16"
        onClick={close}
      >
        {hasMultiple && index > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:left-6"
            onClick={(event) => {
              event.stopPropagation();
              goPrevious();
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        <img
          src={currentUrl}
          alt=""
          className="max-h-[85vh] max-w-[90vw] object-contain transition-opacity duration-200"
          onClick={(event) => event.stopPropagation()}
          draggable={false}
        />

        {hasMultiple && index < images.length - 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:right-6"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
