import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let browserQueryClient: QueryClient | undefined;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const getRouter = () => {
  const queryClient = browserQueryClient ?? createQueryClient();
  if (typeof window !== "undefined") {
    browserQueryClient = queryClient;
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
