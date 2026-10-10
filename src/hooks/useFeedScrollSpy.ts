import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks which feed post is most visible in the viewport center band.
 */
export function useFeedScrollSpy(postIds: string[], layoutKey = 0) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const ratiosRef = useRef<Map<string, number>>(new Map());
  const nodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const pickActive = useCallback(() => {
    let bestId: string | null = null;
    let bestRatio = 0;

    for (const id of postIds) {
      const ratio = ratiosRef.current.get(id) ?? 0;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    }

    if (bestId) setActivePostId(bestId);
  }, [postIds]);

  useEffect(() => {
    if (postIds.length === 0) {
      setActivePostId(null);
      return;
    }

    setActivePostId((prev) => (prev && postIds.includes(prev) ? prev : postIds[0]));
    ratiosRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-post-id");
          if (!id) continue;
          ratiosRef.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        pickActive();
      },
      {
        root: null,
        rootMargin: "-30% 0px -30% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    observerRef.current = observer;
    for (const node of nodesRef.current.values()) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [postIds, pickActive, layoutKey]);

  const refreshScrollSpy = useCallback(() => {
    requestAnimationFrame(() => {
      const observer = observerRef.current;
      if (!observer) {
        pickActive();
        return;
      }
      for (const node of nodesRef.current.values()) {
        observer.unobserve(node);
        observer.observe(node);
      }
      pickActive();
    });
  }, [pickActive]);

  const setPostRef = useCallback(
    (postId: string) => (node: HTMLElement | null) => {
      const observer = observerRef.current;
      const prev = nodesRef.current.get(postId);

      if (prev && observer) observer.unobserve(prev);

      if (node) {
        nodesRef.current.set(postId, node);
        observer?.observe(node);
      } else {
        nodesRef.current.delete(postId);
        ratiosRef.current.delete(postId);
      }
    },
    [],
  );

  return { activePostId, setPostRef, refreshScrollSpy };
}
