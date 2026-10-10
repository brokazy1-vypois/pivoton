import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Clock, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { myConnectionsQueryKey } from "@/hooks/useConnectionWithUser";
import { peerSummaryFromUserId } from "@/lib/connection-peers";
import { cn } from "@/lib/utils";
import {
  acceptConnectionRequest,
  buildConnectionListItems,
  cancelConnectionRequest,
  declineConnectionRequest,
  fetchConnectionsForUser,
  removeConnection,
} from "@/services/connections";
import type { ConnectionListItem } from "@/types/connection";

type ConnectionsSubview = "connected" | "pending";

interface ProfileConnectionsPanelProps {
  userId: string;
}

export function ProfileConnectionsPanel({ userId }: ProfileConnectionsPanelProps) {
  const { user } = useAuth();
  const [subView, setSubView] = useState<ConnectionsSubview>("connected");
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: myConnectionsQueryKey(userId),
    queryFn: () => fetchConnectionsForUser(userId),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });

  const lists = useMemo(
    () =>
      buildConnectionListItems(
        connectionsQuery.data ?? [],
        userId,
        peerSummaryFromUserId,
      ),
    [connectionsQuery.data, userId],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: myConnectionsQueryKey(userId) });
    void queryClient.invalidateQueries({ queryKey: ["connection"] });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptConnectionRequest,
    onSuccess: () => {
      toast.success("Connection accepted");
      invalidate();
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineConnectionRequest,
    onSuccess: () => {
      toast.message("Request declined");
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelConnectionRequest,
    onSuccess: () => {
      toast.message("Request cancelled");
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeConnection,
    onSuccess: () => {
      toast.message("Connection removed");
      invalidate();
    },
  });

  const isOwnProfile = user?.id === userId;

  if (!isOwnProfile) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        Connections are only visible on your own profile.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-border bg-surface-2/50 p-1">
        <button
          type="button"
          onClick={() => setSubView("connected")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition-colors",
            subView === "connected"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Connected ({lists.connected.length})
        </button>
        <button
          type="button"
          onClick={() => setSubView("pending")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition-colors",
            subView === "pending"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Pending ({lists.incomingPending.length + lists.outgoingPending.length})
        </button>
      </div>

      {connectionsQuery.isLoading ? (
        <div className="panel flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading connections…
        </div>
      ) : subView === "connected" ? (
        <ConnectionList
          emptyMessage="You have no connections yet. Visit member profiles on the feed and tap Connect."
          items={lists.connected}
          renderActions={(item) => (
            <Button
              variant="outline"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate(item.connection.id)}
            >
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4 text-primary" />
              Incoming requests
            </h3>
            <ConnectionList
              emptyMessage="No incoming requests."
              items={lists.incomingPending}
              renderActions={(item) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate(item.connection.id)}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={declineMutation.isPending}
                    onClick={() => declineMutation.mutate(item.connection.id)}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              )}
            />
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Sent requests
            </h3>
            <ConnectionList
              emptyMessage="No outgoing requests."
              items={lists.outgoingPending}
              renderActions={(item) => (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(item.connection.id)}
                >
                  Cancel
                </Button>
              )}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function ConnectionList({
  items,
  emptyMessage,
  renderActions,
}: {
  items: ConnectionListItem[];
  emptyMessage: string;
  renderActions: (item: ConnectionListItem) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <div className="panel p-6 text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.connection.id}
          className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            to="/profile/$userId"
            params={{ userId: item.peer.user_id }}
            className="flex min-w-0 items-center gap-3 hover:opacity-90"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {item.peer.avatar.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.peer.full_name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.peer.job_role ?? "Pivoton member"}
              </span>
            </span>
          </Link>
          {renderActions(item)}
        </li>
      ))}
    </ul>
  );
}
