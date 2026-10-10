import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  ConnectionListItem,
  ConnectionPeerSummary,
  ConnectionViewState,
  UserConnection,
} from "@/types/connection";

const LOCAL_CONNECTIONS_KEY = "pivoton-user-connections";

function readLocalConnections(): UserConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_CONNECTIONS_KEY);
    return raw ? (JSON.parse(raw) as UserConnection[]) : [];
  } catch {
    return [];
  }
}

function writeLocalConnections(connections: UserConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_CONNECTIONS_KEY, JSON.stringify(connections));
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-conn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapConnectionRow(row: Record<string, unknown>): UserConnection {
  return {
    id: String(row.id),
    requester_id: String(row.requester_id),
    addressee_id: String(row.addressee_id),
    status: String(row.status) as UserConnection["status"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  };
}

function pairKey(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

function findBetween(
  connections: UserConnection[],
  userA: string,
  userB: string,
): UserConnection | null {
  return (
    connections.find(
      (connection) =>
        (connection.requester_id === userA && connection.addressee_id === userB) ||
        (connection.requester_id === userB && connection.addressee_id === userA),
    ) ?? null
  );
}

export function resolveConnectionViewState(
  connection: UserConnection | null,
  currentUserId: string,
): ConnectionViewState {
  if (!connection || connection.status === "declined") return "none";
  if (connection.status === "accepted") return "connected";
  if (connection.requester_id === currentUserId) return "pending_outgoing";
  if (connection.addressee_id === currentUserId) return "pending_incoming";
  return "none";
}

export function isConnected(connection: UserConnection | null): boolean {
  return connection?.status === "accepted";
}

async function fetchSupabaseConnectionBetween(
  currentUserId: string,
  targetUserId: string,
): Promise<UserConnection | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("user_connections")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`,
    )
    .neq("status", "declined")
    .maybeSingle();

  if (error || !data) return null;
  return mapConnectionRow(data as Record<string, unknown>);
}

async function fetchSupabaseConnectionsForUser(userId: string): Promise<UserConnection[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("user_connections")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .neq("status", "declined")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapConnectionRow(row as Record<string, unknown>));
}

export async function fetchConnectionBetween(
  currentUserId: string,
  targetUserId: string,
): Promise<UserConnection | null> {
  if (currentUserId === targetUserId) return null;

  if (isSupabaseConfigured) {
    const remote = await fetchSupabaseConnectionBetween(currentUserId, targetUserId);
    if (remote) return remote;
  }

  return findBetween(readLocalConnections(), currentUserId, targetUserId);
}

export async function fetchConnectionsForUser(userId: string): Promise<UserConnection[]> {
  const local = readLocalConnections().filter(
    (connection) => connection.requester_id === userId || connection.addressee_id === userId,
  );

  if (isSupabaseConfigured) {
    const remote = await fetchSupabaseConnectionsForUser(userId);
    const merged = [...remote];

    for (const item of local) {
      const exists = merged.some(
        (connection) =>
          (connection.requester_id === item.requester_id &&
            connection.addressee_id === item.addressee_id) ||
          (connection.requester_id === item.addressee_id &&
            connection.addressee_id === item.requester_id),
      );
      if (!exists) merged.push(item);
    }

    return merged;
  }

  return local;
}

async function upsertSupabaseConnection(
  connection: Omit<UserConnection, "id" | "created_at" | "updated_at"> & { id?: string },
): Promise<UserConnection | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const now = new Date().toISOString();

  if (connection.id) {
    const { data, error } = await supabase
      .from("user_connections")
      .update({
        status: connection.status,
        updated_at: now,
      })
      .eq("id", connection.id)
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .single();

    if (error || !data) return null;
    return mapConnectionRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("user_connections")
    .insert({
      requester_id: connection.requester_id,
      addressee_id: connection.addressee_id,
      status: connection.status,
      updated_at: now,
    })
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .single();

  if (error || !data) return null;
  return mapConnectionRow(data as Record<string, unknown>);
}

async function deleteSupabaseConnection(connectionId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const { error } = await supabase.from("user_connections").delete().eq("id", connectionId);
  return !error;
}

function upsertLocalConnection(connection: UserConnection): UserConnection {
  const connections = readLocalConnections();
  const existingIndex = connections.findIndex((item) => item.id === connection.id);
  const pairExistingIndex = connections.findIndex(
    (item) =>
      (item.requester_id === connection.requester_id &&
        item.addressee_id === connection.addressee_id) ||
      (item.requester_id === connection.addressee_id &&
        item.addressee_id === connection.requester_id),
  );

  if (existingIndex >= 0) {
    connections[existingIndex] = connection;
  } else if (pairExistingIndex >= 0) {
    connections[pairExistingIndex] = connection;
  } else {
    connections.push(connection);
  }

  writeLocalConnections(connections);
  return connection;
}

function deleteLocalConnection(connectionId: string): void {
  writeLocalConnections(readLocalConnections().filter((item) => item.id !== connectionId));
}

export async function sendConnectionRequest(
  requesterId: string,
  addresseeId: string,
): Promise<UserConnection> {
  const now = new Date().toISOString();
  const existing = await fetchConnectionBetween(requesterId, addresseeId);
  if (existing?.status === "pending") return existing;
  if (existing?.status === "accepted") return existing;

  const draft: UserConnection = {
    id: existing?.id ?? createLocalId(),
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "pending",
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    const saved = await upsertSupabaseConnection(draft);
    if (saved) return saved;
  }

  return upsertLocalConnection(draft);
}

export async function acceptConnectionRequest(connectionId: string): Promise<UserConnection | null> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data, error } = await supabase
          .from("user_connections")
          .update({ status: "accepted", updated_at: now })
          .eq("id", connectionId)
          .select("id, requester_id, addressee_id, status, created_at, updated_at")
          .single();

        if (!error && data) {
          const saved = mapConnectionRow(data as Record<string, unknown>);
          upsertLocalConnection(saved);
          return saved;
        }
      }
    }
  }

  const local = readLocalConnections().find((item) => item.id === connectionId);
  if (!local) return null;

  const updated = { ...local, status: "accepted" as const, updated_at: now };
  return upsertLocalConnection(updated);
}

export async function declineConnectionRequest(connectionId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const deleted = await deleteSupabaseConnection(connectionId);
    if (deleted) {
      deleteLocalConnection(connectionId);
      return;
    }
  }

  deleteLocalConnection(connectionId);
}

export async function cancelConnectionRequest(connectionId: string): Promise<void> {
  await declineConnectionRequest(connectionId);
}

export async function removeConnection(connectionId: string): Promise<void> {
  await declineConnectionRequest(connectionId);
}

export function buildConnectionListItems(
  connections: UserConnection[],
  currentUserId: string,
  peerLookup: (userId: string) => ConnectionPeerSummary | null,
): {
  connected: ConnectionListItem[];
  incomingPending: ConnectionListItem[];
  outgoingPending: ConnectionListItem[];
} {
  const connected: ConnectionListItem[] = [];
  const incomingPending: ConnectionListItem[] = [];
  const outgoingPending: ConnectionListItem[] = [];

  for (const connection of connections) {
    const peerId =
      connection.requester_id === currentUserId
        ? connection.addressee_id
        : connection.requester_id;
    const peer = peerLookup(peerId);
    if (!peer) continue;

    const item: ConnectionListItem = {
      connection,
      peer,
      direction: connection.requester_id === currentUserId ? "outgoing" : "incoming",
    };

    if (connection.status === "accepted") {
      connected.push(item);
    } else if (connection.status === "pending") {
      if (connection.addressee_id === currentUserId) {
        incomingPending.push(item);
      } else {
        outgoingPending.push(item);
      }
    }
  }

  return { connected, incomingPending, outgoingPending };
}

export { pairKey as connectionPairKey };
