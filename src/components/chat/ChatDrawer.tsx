import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import {
  fetchConversationMessages,
  getOrCreateDirectConversation,
  markConversationRead,
  sendChatMessage,
  subscribeToConversationMessages,
  subscribeToTypingIndicator,
} from "@/services/chat";
import type { ChatMessage } from "@/types/chat";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatDrawer() {
  const { user } = useAuth();
  const { activeChat, closeChat, setConversationId } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingBroadcastRef = useRef<((isTyping: boolean) => void) | null>(null);

  const open = Boolean(activeChat);
  const peer = activeChat?.peer ?? null;
  const conversationId = activeChat?.conversationId ?? null;

  useEffect(() => {
    if (!open || !user || !peer) return;

    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const conversation = await getOrCreateDirectConversation(
          {
            userId: user!.id,
            fullName: user!.fullName,
            avatar: user!.avatar ?? user!.fullName.slice(0, 2).toUpperCase(),
          },
          peer!,
        );
        if (cancelled) return;

        setConversationId(conversation.id);
        const history = await fetchConversationMessages(conversation.id);
        if (cancelled) return;

        setMessages(history);
        await markConversationRead(conversation.id, user!.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not open chat";
        toast.error("Chat unavailable", { description: message });
        closeChat();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [open, user, peer, closeChat, setConversationId]);

  useEffect(() => {
    if (!conversationId) return;

    return subscribeToConversationMessages(conversationId, (message) => {
      setMessages((current) => {
        if (current.some((m) => m.id === message.id)) return current;
        return [...current, message];
      });
      if (user && message.sender_id !== user.id) {
        void markConversationRead(conversationId, user.id);
      }
    });
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user) return;

    const typing = subscribeToTypingIndicator(conversationId, (payload) => {
      if (payload.userId === user.id) return;
      setTypingName(payload.isTyping ? payload.name : null);
    });

    typingBroadcastRef.current = (isTyping: boolean) => {
      typing.broadcastTyping(user.id, user.fullName, isTyping);
    };

    return () => {
      typingBroadcastRef.current = null;
      typing.unsubscribe();
    };
  }, [conversationId, user]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typingName]);

  const broadcastTyping = useCallback((isTyping: boolean) => {
    typingBroadcastRef.current?.(isTyping);
  }, []);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    broadcastTyping(true);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      broadcastTyping(false);
    }, 1200);
  };

  const handleSend = async () => {
    if (!conversationId || !user || !draft.trim()) return;

    setIsSending(true);
    try {
      const saved = await sendChatMessage({
        conversationId,
        sender: {
          userId: user.id,
          fullName: user.fullName,
          avatar: user.avatar ?? user.fullName.slice(0, 2).toUpperCase(),
        },
        content: draft,
      });
      setMessages((current) => {
        if (current.some((m) => m.id === saved.id)) return current;
        return [...current, saved];
      });
      setDraft("");
      broadcastTyping(false);
      await markConversationRead(conversationId, user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      toast.error("Could not send message", { description: message });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setDraft("");
      setTypingName(null);
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeChat();
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-4 text-left">
          <SheetTitle>{peer?.fullName ?? "Direct message"}</SheetTitle>
          <SheetDescription>Private conversation · synced in realtime</SheetDescription>
        </SheetHeader>

        <div ref={listRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No messages yet. Say hello to {peer?.fullName ?? "this member"}.
            </p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={cn("flex flex-col gap-0.5", isMine ? "items-end" : "items-start")}
                >
                  {!isMine && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {message.sender_name}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      isMine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-secondary text-secondary-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatMessageTime(message.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {typingName && (
          <p className="px-4 pb-1 text-xs text-muted-foreground">{typingName} is typing…</p>
        )}

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Input
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            placeholder="Write a message…"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            disabled={isLoading || isSending}
          />
          <Button
            size="icon"
            disabled={isLoading || isSending || !draft.trim()}
            onClick={() => void handleSend()}
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
