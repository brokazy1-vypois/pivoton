import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface CursorPreviewState {
  url: string;
  x: number;
  y: number;
}

const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 288;
const VIEWPORT_PADDING = 16;
const CURSOR_OFFSET = 20;

export function resolvePreviewImageUrl(url: string): string {
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return url.replace(/w=\d+/g, "w=960").replace(/h=\d+/g, "h=960");
}

export function computeCursorPreviewPosition(clientX: number, clientY: number) {
  if (typeof window === "undefined") {
    return { left: clientX, top: clientY };
  }

  let left = clientX + CURSOR_OFFSET;
  let top = clientY + CURSOR_OFFSET;

  if (left + PREVIEW_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
    left = clientX - PREVIEW_WIDTH - CURSOR_OFFSET;
  }
  if (top + PREVIEW_HEIGHT > window.innerHeight - VIEWPORT_PADDING) {
    top = clientY - PREVIEW_HEIGHT - CURSOR_OFFSET;
  }

  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - PREVIEW_WIDTH - VIEWPORT_PADDING),
  );
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - PREVIEW_HEIGHT - VIEWPORT_PADDING),
  );

  return { left, top };
}

interface ImageMagnifierContextValue {
  showPreview: (url: string, x: number, y: number) => void;
  movePreview: (url: string, x: number, y: number) => void;
  hidePreview: () => void;
}

const ImageMagnifierContext = createContext<ImageMagnifierContextValue | null>(null);

function useImageMagnifier() {
  return useContext(ImageMagnifierContext);
}

interface HopeImageMagnifierProviderProps {
  children: ReactNode;
}

export function HopeImageMagnifierProvider({ children }: HopeImageMagnifierProviderProps) {
  const [preview, setPreview] = useState<CursorPreviewState | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showPreview = useCallback(
    (url: string, x: number, y: number) => {
      clearHideTimer();
      setPreview({ url, x, y });
      setVisible(true);
    },
    [clearHideTimer],
  );

  const movePreview = useCallback((url: string, x: number, y: number) => {
    setPreview((current) => {
      if (!current || current.url !== url) return { url, x, y };
      if (current.x === x && current.y === y) return current;
      return { url, x, y };
    });
    setVisible(true);
  }, []);

  const hidePreview = useCallback(() => {
    clearHideTimer();
    setVisible(false);
    hideTimerRef.current = window.setTimeout(() => {
      setPreview(null);
      hideTimerRef.current = null;
    }, 120);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const value = useMemo(
    () => ({ showPreview, movePreview, hidePreview }),
    [hidePreview, movePreview, showPreview],
  );

  return (
    <ImageMagnifierContext.Provider value={value}>
      {children}
      <ImageCursorMagnifierLayer preview={preview} visible={visible} />
    </ImageMagnifierContext.Provider>
  );
}

interface ImageCursorMagnifierLayerProps {
  preview: CursorPreviewState | null;
  visible: boolean;
}

export function ImageCursorMagnifierLayer({ preview, visible }: ImageCursorMagnifierLayerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !preview?.url) return null;

  const { left, top } = computeCursorPreviewPosition(preview.x, preview.y);

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed z-[99999] transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ left, top, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
      aria-hidden
    >
      <div className="relative h-full w-full scale-100 transition-transform duration-150 ease-out">
        <div className="absolute -inset-1 rounded-2xl bg-primary/10 blur-md" />
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-primary/30 bg-[#0B132B]/98 p-2 shadow-2xl shadow-black/70 ring-1 ring-white/10 backdrop-blur-md">
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
            <span className="h-2 w-2 rounded-full bg-primary/80" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary/80">
              Preview
            </span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black/20">
            <img
              src={resolvePreviewImageUrl(preview.url)}
              alt=""
              className="h-full w-full object-contain transition-transform duration-200 ease-out"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface HoverMagnifierThumbnailProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  isActive?: boolean;
  /** When true, image fills its parent instead of using fixed `size` pixels. */
  fill?: boolean;
  onClick?: () => void;
  /** Standalone mode when no provider is mounted. */
  onPreviewChange?: (preview: CursorPreviewState | null) => void;
}

export function HoverMagnifierThumbnail({
  src,
  alt = "",
  size = 52,
  fill = false,
  className,
  isActive: isActiveProp,
  onClick,
  onPreviewChange,
}: HoverMagnifierThumbnailProps) {
  const magnifier = useImageMagnifier();
  const [localActive, setLocalActive] = useState(false);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    if (magnifier) {
      magnifier.movePreview(src, event.clientX, event.clientY);
      return;
    }
    onPreviewChange?.({ url: src, x: event.clientX, y: event.clientY });
  };

  const handleEnter = (event: MouseEvent<HTMLDivElement>) => {
    setLocalActive(true);
    if (magnifier) {
      magnifier.showPreview(src, event.clientX, event.clientY);
      return;
    }
    onPreviewChange?.({ url: src, x: event.clientX, y: event.clientY });
  };

  const handleLeave = () => {
    setLocalActive(false);
    if (magnifier) {
      magnifier.hidePreview();
      return;
    }
    onPreviewChange?.(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    magnifier?.hidePreview();
    onPreviewChange?.(null);
    onClick?.();
  };

  const isActive = isActiveProp ?? localActive;

  return (
    <div
      className={cn(
        "relative cursor-zoom-in",
        fill ? "h-full w-full min-h-0 min-w-0 overflow-hidden" : "shrink-0",
      )}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && onClick) {
          event.preventDefault();
          handleClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Open image ${alt || "attachment"}` : undefined}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        className={cn(
          "object-cover transition-[box-shadow,filter,transform] duration-300 ease-in-out",
          fill ? "h-full w-full" : "rounded-md border border-border/60",
          !fill && "transition-[box-shadow,ring-color,transform] duration-200 ease-out",
          isActive && !fill && "ring-2 ring-primary/50 shadow-lg shadow-primary/10",
          className,
        )}
        style={fill ? undefined : { width: size, height: size }}
      />
    </div>
  );
}

export { PREVIEW_HEIGHT, PREVIEW_WIDTH };
