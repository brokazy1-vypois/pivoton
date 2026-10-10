import { useRouter, type LinkProps } from "@tanstack/react-router";
import { useCallback, useRef } from "react";

type PrefetchTarget = {
  to: NonNullable<LinkProps["to"]>;
  search?: LinkProps["search"];
};

export function useRoutePrefetch() {
  const router = useRouter();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchRoute = useCallback(
    ({ to, search }: PrefetchTarget) => {
      const key = `${String(to)}:${JSON.stringify(search ?? null)}`;
      if (prefetchedRef.current.has(key)) return;
      prefetchedRef.current.add(key);

      requestAnimationFrame(() => {
        void router.preloadRoute(
          search !== undefined
            ? ({ to, search } as Parameters<typeof router.preloadRoute>[0])
            : ({ to } as Parameters<typeof router.preloadRoute>[0]),
        );
      });
    },
    [router],
  );

  return { prefetchRoute };
}
