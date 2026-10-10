import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChatPeer, PeerCallMode } from "@/types/chat";

export interface ActiveChat {
  peer: ChatPeer;
  conversationId: string | null;
}

export interface ActiveCall {
  peer: ChatPeer;
  mode: PeerCallMode;
  roomUrl: string | null;
  isCreating: boolean;
}

interface ChatContextValue {
  activeChat: ActiveChat | null;
  activeCall: ActiveCall | null;
  premiumUpgradeOpen: boolean;
  openChat: (peer: ChatPeer) => void;
  closeChat: () => void;
  setConversationId: (conversationId: string) => void;
  startCall: (peer: ChatPeer, mode: PeerCallMode) => void;
  setCallRoomUrl: (roomUrl: string | null) => void;
  setCallCreating: (isCreating: boolean) => void;
  endCall: () => void;
  openPremiumUpgrade: () => void;
  closePremiumUpgrade: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [premiumUpgradeOpen, setPremiumUpgradeOpen] = useState(false);

  const openChat = useCallback((peer: ChatPeer) => {
    setActiveChat({ peer, conversationId: null });
  }, []);

  const closeChat = useCallback(() => {
    setActiveChat(null);
  }, []);

  const setConversationId = useCallback((conversationId: string) => {
    setActiveChat((current) => (current ? { ...current, conversationId } : current));
  }, []);

  const startCall = useCallback((peer: ChatPeer, mode: PeerCallMode) => {
    setActiveCall({ peer, mode, roomUrl: null, isCreating: true });
  }, []);

  const setCallRoomUrl = useCallback((roomUrl: string | null) => {
    setActiveCall((current) =>
      current ? { ...current, roomUrl, isCreating: false } : current,
    );
  }, []);

  const setCallCreating = useCallback((isCreating: boolean) => {
    setActiveCall((current) => (current ? { ...current, isCreating } : current));
  }, []);

  const endCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const openPremiumUpgrade = useCallback(() => {
    setPremiumUpgradeOpen(true);
  }, []);

  const closePremiumUpgrade = useCallback(() => {
    setPremiumUpgradeOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      activeChat,
      activeCall,
      premiumUpgradeOpen,
      openChat,
      closeChat,
      setConversationId,
      startCall,
      setCallRoomUrl,
      setCallCreating,
      endCall,
      openPremiumUpgrade,
      closePremiumUpgrade,
    }),
    [
      activeChat,
      activeCall,
      premiumUpgradeOpen,
      openChat,
      closeChat,
      setConversationId,
      startCall,
      setCallRoomUrl,
      setCallCreating,
      endCall,
      openPremiumUpgrade,
      closePremiumUpgrade,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
