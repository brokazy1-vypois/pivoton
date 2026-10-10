export interface ChatParticipant {
  user_id: string;
  display_name: string;
  display_avatar: string;
  last_read_at: string | null;
}

export interface ChatConversation {
  id: string;
  direct_key: string | null;
  created_at: string;
  updated_at: string;
  participants?: ChatParticipant[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface ChatPeer {
  userId: string;
  fullName: string;
  avatar: string;
}

export type PeerCallMode = "audio" | "video";
