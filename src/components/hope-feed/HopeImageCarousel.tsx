import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HoverMagnifierThumbnail } from "@/components/hope-feed/ImageCursorMagnifier";
import { HopeImageLightbox } from "@/components/hope-feed/HopeImageLightbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HopeImageCarouselProps {
  images: string[];
}

const VISIBLE_FRAMES = 5;
const THUMB_GAP_PX = 8;
const DRAG_CLICK_THRESHOLD_PX = 6;
const SLIDE_ANIMATION_MS = 320;
const WHEEL_SNAP_DELAY_MS = 120;
const SCROLL_INDICATOR_HIDE_MS = 650;
/** px/ms — flick faster than this commits a slot in the flick direction. */
const FLICK_VELOCITY_PX_MS = 0.25;

function clampIndex(index: number, maxOffset: number): number {
  return Math.max(0, Math.min(maxOffset, index));
}

function clampScrollOffset(offset: number, imageCount: number): number {
  const max = Math.max(0, imageCount - VISIBLE_FRAMES);
  return Math.max(0, Math.min(max, offset));
}

function initialScrollOffset(_imageCount: number): number {
  return 0;
}

function isSettledOffset(offset: number): boolean {
  return Math.abs(offset - Math.round(offset)) < 0.001;
}

function scrollRatio(offset: number, maxOffset: number): number {
  if (maxOffset <= 0) return 0;
  return Math.max(0, Math.min(1, offset / maxOffset));
}

function resolveSnapTarget(
  startOffset: number,
  currentOffset: number,
  velocityPxMs: number,
  maxOffset: number,
  moved: boolean,
): number {
  if (maxOffset <= 0) return 0;

  const delta = currentOffset - startOffset;

  if (!moved && Math.abs(delta) < 0.001) {
    return clampIndex(Math.round(currentOffset), maxOffset);
  }

  let direction: -1 | 0 | 1 = 0;
  if (delta > 0.0001) direction = 1;
  else if (delta < -0.0001) direction = -1;
  else if (velocityPxMs < -FLICK_VELOCITY_PX_MS) direction = 1;
  else if (velocityPxMs > FLICK_VELOCITY_PX_MS) direction = -1;

  if (direction === 0) {
    return clampIndex(Math.round(currentOffset), maxOffset);
  }

  const anchor = Math.round(startOffset);
  let target = clampIndex(anchor + direction, maxOffset);

  if (direction > 0 && target < currentOffset - 0.001) {
    target = clampIndex(Math.ceil(currentOffset - 0.0001), maxOffset);
  }
  if (direction < 0 && target > currentOffset + 0.001) {
    target = clampIndex(Math.floor(currentOffset + 0.0001), maxOffset);
  }

  return target;
}

function CarouselThumbnail({
  url,
  index,
  sizePx,
  onOpen,
  suppressClick,
}: {
  url: string;
  index: number;
  sizePx: number;
  onOpen: (index: number) => void;
  suppressClick?: () => boolean;
}) {
  return (
    <div
      className="aspect-square shrink-0 overflow-hidden rounded-xl border border-border/40 bg-surface-2/40"
      style={{ width: sizePx, height: sizePx }}
    >
      <HoverMagnifierThumbnail
        fill
        src={url}
        alt={`Attachment ${index + 1}`}
        onClick={() => {
          if (suppressClick?.()) return;
          onOpen(index);
        }}
      />
    </div>
  );
}

/** Passive indicator — visible only while scrolling, no drag interaction. */
function PassiveScrollIndicator({
  visible,
  scrollOffset,
  maxOffset,
  imageCount,
}: {
  visible: boolean;
  scrollOffset: number;
  maxOffset: number;
  imageCount: number;
}) {
  if (maxOffset <= 0) return null;

  const thumbFraction = Math.min(1, VISIBLE_FRAMES / Math.max(imageCount, 1));
  const position = scrollRatio(scrollOffset, maxOffset);
  const thumbLeft = position * (1 - thumbFraction) * 100;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none mt-2 h-1 w-full transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="relative h-full w-full rounded-full bg-slate-800/30">
        <div
          className="absolute top-0 h-full rounded-full bg-slate-500/70 transition-[left,width] duration-150 ease-out"
          style={{
            width: `${thumbFraction * 100}%`,
            left: `${thumbLeft}%`,
          }}
        />
      </div>
    </div>
  );
}

export function HopeImageCarousel({ images }: HopeImageCarouselProps) {
  const dragStateRef = useRef({ suppressClick: false });
  const pointerSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
    lastX: number;
    lastTime: number;
    velocityPxMs: number;
    dragging: boolean;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef(0);
  const slideAnimRef = useRef<number | null>(null);
  const wheelSnapTimerRef = useRef<number | null>(null);
  const wheelGestureRef = useRef({ startOffset: 0, accumulatedDelta: 0 });
  const indicatorHideTimerRef = useRef<number | null>(null);

  const [thumbSizePx, setThumbSizePx] = useState(72);
  const [dragPxPerIndex, setDragPxPerIndex] = useState(80);
  const [scrollOffset, setScrollOffset] = useState(() => initialScrollOffset(images.length));
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  scrollOffsetRef.current = scrollOffset;

  const maxOffset = Math.max(0, images.length - VISIBLE_FRAMES);
  const canScrollLeft = scrollOffset > 0;
  const canScrollRight = scrollOffset < maxOffset;
  const canScroll = maxOffset > 0;

  const stridePx = dragPxPerIndex;

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const measure = () => {
      const width = node.clientWidth;
      if (width <= 0) return;
      const size = (width - THUMB_GAP_PX * (VISIBLE_FRAMES - 1)) / VISIBLE_FRAMES;
      setThumbSizePx(size);
      setDragPxPerIndex(size + THUMB_GAP_PX);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [images.length]);

  const isScrolling =
    isDragging || isAnimating || !isSettledOffset(scrollOffset);

  useEffect(() => {
    if (isScrolling) {
      if (indicatorHideTimerRef.current !== null) {
        window.clearTimeout(indicatorHideTimerRef.current);
        indicatorHideTimerRef.current = null;
      }
      setIndicatorVisible(true);
      return;
    }

    indicatorHideTimerRef.current = window.setTimeout(() => {
      setIndicatorVisible(false);
      indicatorHideTimerRef.current = null;
    }, SCROLL_INDICATOR_HIDE_MS);

    return () => {
      if (indicatorHideTimerRef.current !== null) {
        window.clearTimeout(indicatorHideTimerRef.current);
      }
    };
  }, [isScrolling]);

  useEffect(() => {
    return () => {
      if (slideAnimRef.current !== null) cancelAnimationFrame(slideAnimRef.current);
      if (wheelSnapTimerRef.current !== null) window.clearTimeout(wheelSnapTimerRef.current);
      if (indicatorHideTimerRef.current !== null) window.clearTimeout(indicatorHideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setScrollOffset((current) => clampScrollOffset(current, images.length));
  }, [images.length]);

  const suppressClick = useCallback(() => dragStateRef.current.suppressClick, []);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const animateScrollTo = useCallback(
    (targetOffset: number) => {
      const startOffset = scrollOffsetRef.current;
      const clampedTarget = clampScrollOffset(targetOffset, images.length);
      if (Math.abs(clampedTarget - startOffset) < 0.001) return;

      if (slideAnimRef.current !== null) {
        cancelAnimationFrame(slideAnimRef.current);
        slideAnimRef.current = null;
      }

      setIsAnimating(true);
      const startTime = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / SLIDE_ANIMATION_MS);
        const eased = 1 - (1 - progress) ** 3;
        setScrollOffset(startOffset + (clampedTarget - startOffset) * eased);

        if (progress < 1) {
          slideAnimRef.current = requestAnimationFrame(tick);
          return;
        }

        setScrollOffset(clampedTarget);
        slideAnimRef.current = null;
        setIsAnimating(false);
      };

      slideAnimRef.current = requestAnimationFrame(tick);
    },
    [images.length],
  );

  const snapWithIntent = useCallback(
    (startOffset: number, velocityPxMs: number, moved: boolean) => {
      const target = resolveSnapTarget(
        startOffset,
        scrollOffsetRef.current,
        velocityPxMs,
        maxOffset,
        moved,
      );
      animateScrollTo(target);
    },
    [animateScrollTo, maxOffset],
  );

  const smoothSlideBy = useCallback(
    (direction: -1 | 1) => {
      const target = clampScrollOffset(Math.round(scrollOffsetRef.current) + direction, images.length);
      animateScrollTo(target);
    },
    [animateScrollTo, images.length],
  );

  const scheduleWheelSnap = useCallback(() => {
    if (wheelSnapTimerRef.current !== null) {
      window.clearTimeout(wheelSnapTimerRef.current);
    }
    wheelSnapTimerRef.current = window.setTimeout(() => {
      wheelSnapTimerRef.current = null;
      const { startOffset, accumulatedDelta } = wheelGestureRef.current;
      snapWithIntent(startOffset, 0, Math.abs(accumulatedDelta) > 0.0001);
      wheelGestureRef.current.accumulatedDelta = 0;
    }, WHEEL_SNAP_DELAY_MS);
  }, [snapWithIntent]);

  const cancelCarouselAnimations = useCallback(() => {
    if (wheelSnapTimerRef.current !== null) {
      window.clearTimeout(wheelSnapTimerRef.current);
      wheelSnapTimerRef.current = null;
    }
    if (slideAnimRef.current !== null) {
      cancelAnimationFrame(slideAnimRef.current);
      slideAnimRef.current = null;
      setIsAnimating(false);
    }
  }, []);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !canScroll) return;

    const onWheel = (event: WheelEvent) => {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      const horizontalIntent = absX > absY * 0.5 || (event.shiftKey && absY > 0);
      if (!horizontalIntent) return;

      event.preventDefault();
      event.stopPropagation();

      if (wheelSnapTimerRef.current === null) {
        wheelGestureRef.current.startOffset = scrollOffsetRef.current;
        wheelGestureRef.current.accumulatedDelta = 0;
      }

      const rawDelta = absX > 0 ? event.deltaX : event.deltaY;
      const indexDelta = -rawDelta / dragPxPerIndex;
      wheelGestureRef.current.accumulatedDelta += indexDelta;

      setScrollOffset((current) =>
        clampScrollOffset(current + indexDelta, images.length),
      );
      scheduleWheelSnap();
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [dragPxPerIndex, images.length, canScroll, scheduleWheelSnap]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !canScroll) return;

      cancelCarouselAnimations();
      dragStateRef.current.suppressClick = false;

      const now = performance.now();
      pointerSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startOffset: scrollOffsetRef.current,
        lastX: event.clientX,
        lastTime: now,
        velocityPxMs: 0,
        dragging: false,
      };
    },
    [cancelCarouselAnimations, canScroll],
  );

  const onWindowPointerMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const session = pointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - session.startX;

      if (!session.dragging) {
        if (Math.abs(deltaX) <= DRAG_CLICK_THRESHOLD_PX) return;
        session.dragging = true;
        setIsDragging(true);
        viewportRef.current?.setPointerCapture(event.pointerId);
      }

      const now = performance.now();
      const dt = now - session.lastTime;
      if (dt > 0 && dt < 100) {
        const instant = (event.clientX - session.lastX) / dt;
        session.velocityPxMs = session.velocityPxMs * 0.4 + instant * 0.6;
      }
      session.lastX = event.clientX;
      session.lastTime = now;

      const nextOffset = session.startOffset - deltaX / dragPxPerIndex;
      setScrollOffset(clampScrollOffset(nextOffset, images.length));
    },
    [dragPxPerIndex, images.length],
  );

  const onWindowPointerUp = useCallback(
    (event: globalThis.PointerEvent) => {
      const session = pointerSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      if (session.dragging) {
        setIsDragging(false);
        if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
          viewportRef.current.releasePointerCapture(event.pointerId);
        }
        snapWithIntent(session.startOffset, session.velocityPxMs, true);
        dragStateRef.current.suppressClick = true;
        window.setTimeout(() => {
          dragStateRef.current.suppressClick = false;
        }, 0);
      }

      pointerSessionRef.current = null;
    },
    [snapWithIntent],
  );

  useEffect(() => {
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      pointerSessionRef.current = null;
    };
  }, [onWindowPointerMove, onWindowPointerUp]);

  if (images.length === 0) return null;

  const translateX = -scrollOffset * stridePx;

  return (
    <div
      className="relative w-full min-w-0 max-w-full overscroll-x-contain"
      onWheel={(event) => event.stopPropagation()}
    >
      {canScroll && canScrollLeft && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute -left-1 top-[calc(50%-0.5rem)] z-10 h-7 w-7 -translate-y-1/2 rounded-full bg-surface/90 shadow-md"
          onClick={() => smoothSlideBy(-1)}
          aria-label="Scroll images left"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {canScroll && canScrollRight && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute -right-1 top-[calc(50%-0.5rem)] z-10 h-7 w-7 -translate-y-1/2 rounded-full bg-surface/90 shadow-md"
          onClick={() => smoothSlideBy(1)}
          aria-label="Scroll images right"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "w-full overflow-hidden overscroll-x-contain",
          canScroll && (isDragging ? "cursor-grabbing select-none" : "cursor-grab"),
        )}
        style={{
          touchAction: "pan-y pinch-zoom",
          overscrollBehaviorX: "contain",
        }}
        onPointerDown={handlePointerDown}
      >
        <div
          className={cn(
            "flex w-max items-end justify-start",
            isAnimating && "will-change-transform",
          )}
          style={{
            gap: THUMB_GAP_PX,
            transform: `translate3d(${translateX}px, 0, 0)`,
            transition: isAnimating ? undefined : "none",
          }}
        >
          {images.map((url, index) => (
            <CarouselThumbnail
              key={`${index}-${url.slice(0, 48)}`}
              url={url}
              index={index}
              sizePx={thumbSizePx}
              onOpen={openLightbox}
              suppressClick={suppressClick}
            />
          ))}
        </div>
      </div>

      <PassiveScrollIndicator
        visible={canScroll && indicatorVisible}
        scrollOffset={scrollOffset}
        maxOffset={maxOffset}
        imageCount={images.length}
      />

      <HopeImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
