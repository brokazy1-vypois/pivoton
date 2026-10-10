import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ChatConversation, ChatMessage, ChatPeer } from "@/types/chat";

const LOCAL_CONVERSATIONS_KEY = "pivoton-chat-conversations";
const LOCAL_MESSAGES_KEY = "pivoton-chat-messages";

function directKey(userA: string, userB: string): string {
  return [userA, userB].sort().join("::");
}

function readLocalConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatConversation[]) : [];
  } catch {
    return [];
  }
}

function writeLocalConversations(conversations: ChatConversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function readLocalMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeLocalMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
}

function mapConversationRow(row: Record<string, unknown>): ChatConversation {
  return {
    id: String(row.id),
    direct_key: row.direct_key ? String(row.direct_key) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  };
}

function mapMessageRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_id: String(row.sender_id),
    sender_name: String(row.sender_name ?? ""),
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createLocalConversation(
  currentUser: ChatPeer,
  targetUser: ChatPeer,
): ChatConversation {
  const key = directKey(currentUser.userId, targetUser.userId);
  const existing = readLocalConversations().find((c) => c.direct_key === key);
  if (existing) return existing;

  const now = new Date().toISOString();
  const conversation: ChatConversation = {
    id: createLocalId(),
    direct_key: key,
    created_at: now,
    updated_at: now,
    participants: [
      {
        user_id: currentUser.userId,
        display_name: currentUser.fullName,
        display_avatar: currentUser.avatar,
        last_read_at: now,
      },
      {
        user_id: targetUser.userId,
        display_name: targetUser.fullName,
        display_avatar: targetUser.avatar,
        last_read_at: null,
      },
    ],
  };

  const conversations = [...readLocalConversations(), conversation];
  writeLocalConversations(conversations);
  return conversation;
}

async function createSupabaseConversation(
  currentUser: ChatPeer,
  targetUser: ChatPeer,
): Promise<ChatConversation | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const key = directKey(currentUser.userId, targetUser.userId);

    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("id, direct_key, created_at, updated_at")
      .eq("direct_key", key)
      .maybeSingle();

    if (existingError) {
      // Table missing or RLS blocked — use local fallback.
      return null;
    }

    if (existing) return mapConversationRow(existing);

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({ direct_key: key })
      .select("id, direct_key, created_at, updated_at")
      .single();

    if (createError || !created) return null;

    const conversation = mapConversationRow(created);

    const { error: participantsError } = await supabase.from("conversation_participants").upsert(
      [
        {
          conversation_id: conversation.id,
          user_id: currentUser.userId,
          display_name: currentUser.fullName,
          display_avatar: currentUser.avatar,
        },
        {
          conversation_id: conversation.id,
          user_id: targetUser.userId,
          display_name: targetUser.fullName,
          display_avatar: targetUser.avatar,
        },
      ],
      { onConflict: "conversation_id,user_id" },
    );

    if (participantsError) return null;

    return conversation;
  } catch {
    return null;
  }
}

export async function getOrCreateDirectConversation(
  currentUser: ChatPeer,
  targetUser: ChatPeer,
): Promise<ChatConversation> {
  if (currentUser.userId === targetUser.userId) {
    throw new Error("Cannot start a conversation with yourself.");
  }

  try {
    if (isSupabaseConfigured) {
      const remote = await createSupabaseConversation(currentUser, targetUser);
      if (remote) return remote;
    }
  } catch {
    // Use local fallback below.
  }

  return createLocalConversation(currentUser, targetUser);
}

export async function fetchConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, sender_name, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const remote = data.map(mapMessageRow);
      const local = readLocalMessages().filter((m) => m.conversation_id === conversationId);
      const map = new Map<string, ChatMessage>();
      for (const message of remote) map.set(message.id, message);
      for (const message of local) map.set(message.id, message);
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
  }

  return readLocalMessages()
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function sendChatMessage(input: {
  conversationId: string;
  sender: ChatPeer;
  content: string;
}): Promise<ChatMessage> {
  const trimmed = input.content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        sender_id: input.sender.userId,
        sender_name: input.sender.fullName,
        content: trimmed,
      })
      .select("id, conversation_id, sender_id, sender_name, content, created_at")
      .single();

    if (!error && data) {
      await supabase
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", input.conversationId);

      return mapMessageRow(data);
    }
  }

  const message: ChatMessage = {
    id: createLocalId(),
    conversation_id: input.conversationId,
    sender_id: input.sender.userId,
    sender_name: input.sender.fullName,
    content: trimmed,
    created_at: now,
  };

  writeLocalMessages([...readLocalMessages(), message]);

  const conversations = readLocalConversations().map((c) =>
    c.id === input.conversationId ? { ...c, updated_at: now } : c,
  );
  writeLocalConversations(conversations);

  return message;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabase();

  if (supabase) {
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: now })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
  }

  const conversations = readLocalConversations().map((c) => {
    if (c.id !== conversationId) return c;
    return {
      ...c,
      participants: c.participants?.map((p) =>
        p.user_id === userId ? { ...p, last_read_at: now } : p,
      ),
    };
  });
  writeLocalConversations(conversations);
}

export function countUnreadMessages(conversationId: string, userId: string): number {
  const conversation = readLocalConversations().find((c) => c.id === conversationId);
  const lastRead =
    conversation?.participants?.find((p) => p.user_id === userId)?.last_read_at ?? null;

  return readLocalMessages().filter((m) => {
    if (m.conversation_id !== conversationId) return false;
    if (m.sender_id === userId) return false;
    if (!lastRead) return true;
    return new Date(m.created_at).getTime() > new Date(lastRead).getTime();
  }).length;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessage(mapMessageRow(payload.new as Record<string, unknown>));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

export function subscribeToTypingIndicator(
  conversationId: string,
  onTyping: (payload: { userId: string; name: string; isTyping: boolean }) => void,
): {
  unsubscribe: () => void;
  broadcastTyping: (userId: string, name: string, isTyping: boolean) => void;
} {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      unsubscribe: () => {},
      broadcastTyping: () => {},
    };
  }

  try {
    const channel = supabase
      .channel(`typing:${conversationId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as { userId?: string; name?: string; isTyping?: boolean };
        if (!data?.userId || !data?.name) return;
        onTyping({ userId: data.userId, name: data.name, isTyping: Boolean(data.isTyping) });
      })
      .subscribe();

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      },
      broadcastTyping: (userId, name, isTyping) => {
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, name, isTyping },
        });
      },
    };
  } catch {
    return {
      unsubscribe: () => {},
      broadcastTyping: () => {},
    };
  }
}
