import { useEffect, useRef, useState, type ReactNode } from "react";

const INITIAL_VISIBLE = 6;
const LOAD_MORE_STEP = 5;

interface HopeFeedTimelineProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

/** Progressive feed renderer — first cards paint immediately, rest load on scroll. */
export function HopeFeedTimeline<T>({ items, getKey, renderItem }: HopeFeedTimelineProps<T>) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [items]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + LOAD_MORE_STEP, items.length));
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  const visibleItems = items.slice(0, visibleCount);

  return (
    <>
      {visibleItems.map((item) => (
        <div key={getKey(item)}>{renderItem(item)}</div>
      ))}
      {visibleCount < items.length ? (
        <div
          ref={sentinelRef}
          className="flex h-12 items-center justify-center text-xs text-muted-foreground"
          aria-hidden
        >
          Loading more hopes…
        </div>
      ) : null}
    </>
  );
}
