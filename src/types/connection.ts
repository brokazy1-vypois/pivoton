export type ConnectionStatus = "pending" | "accepted" | "declined";

export interface UserConnection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export type ConnectionViewState =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "connected";

export interface ConnectionPeerSummary {
  user_id: string;
  full_name: string;
  avatar: string;
  job_role?: string | null;
}

export interface ConnectionListItem {
  connection: UserConnection;
  peer: ConnectionPeerSummary;
  direction: "incoming" | "outgoing";
}
