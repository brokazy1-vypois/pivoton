import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  declineConnectionRequest,
  fetchConnectionBetween,
  removeConnection,
  resolveConnectionViewState,
  sendConnectionRequest,
} from "@/services/connections";
import type { ConnectionViewState, UserConnection } from "@/types/connection";

export function connectionQueryKey(currentUserId: string, targetUserId: string) {
  return ["connection", currentUserId, targetUserId] as const;
}

export function myConnectionsQueryKey(userId: string) {
  return ["my-connections", userId] as const;
}

export function useConnectionWithUser(
  currentUserId: string | null | undefined,
  targetUserId: string,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: connectionQueryKey(currentUserId ?? "anon", targetUserId),
    queryFn: () => fetchConnectionBetween(currentUserId!, targetUserId),
    enabled: Boolean(currentUserId && targetUserId && currentUserId !== targetUserId),
    staleTime: 15_000,
  });

  const viewState: ConnectionViewState = resolveConnectionViewState(
    query.data ?? null,
    currentUserId ?? "",
  );

  const invalidate = () => {
    if (!currentUserId) return;
    void queryClient.invalidateQueries({
      queryKey: connectionQueryKey(currentUserId, targetUserId),
    });
    void queryClient.invalidateQueries({
      queryKey: myConnectionsQueryKey(currentUserId),
    });
  };

  const connectMutation = useMutation({
    mutationFn: () => sendConnectionRequest(currentUserId!, targetUserId),
    onSuccess: invalidate,
  });

  const acceptMutation = useMutation({
    mutationFn: (connectionId: string) => acceptConnectionRequest(connectionId),
    onSuccess: invalidate,
  });

  const declineMutation = useMutation({
    mutationFn: (connectionId: string) => declineConnectionRequest(connectionId),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: (connectionId: string) => cancelConnectionRequest(connectionId),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (connectionId: string) => removeConnection(connectionId),
    onSuccess: invalidate,
  });

  return {
    connection: query.data ?? null,
    viewState,
    isLoading: query.isLoading,
    isMutating:
      connectMutation.isPending ||
      acceptMutation.isPending ||
      declineMutation.isPending ||
      cancelMutation.isPending ||
      removeMutation.isPending,
    connect: connectMutation.mutateAsync,
    accept: acceptMutation.mutateAsync,
    decline: declineMutation.mutateAsync,
    cancel: cancelMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  };
}

export function useIsConnectedWith(
  currentUserId: string | null | undefined,
  targetUserId: string,
): boolean {
  const { viewState } = useConnectionWithUser(currentUserId, targetUserId);
  return viewState === "connected";
}

export type { UserConnection };
