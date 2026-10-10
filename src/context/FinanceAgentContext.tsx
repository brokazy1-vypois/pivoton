import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useAiFinanceUsage } from "@/hooks/useAiFinanceUsage";
import {
  streamFinanceAgentReply,
  type FinanceAgentMessage,
} from "@/lib/finance-agent";
import type { VoiceThreadMessage } from "@/types/voice-thread";

const GREETING: FinanceAgentMessage = {
  id: "greeting",
  role: "assistant",
  text: "I can walk through valuation, hedging, tax treatment or any broker call in your rooms. What are we looking at?",
};

interface FinanceAgentContextValue {
  messages: FinanceAgentMessage[];
  voiceMessages: VoiceThreadMessage[];
  isLoading: boolean;
  isVoiceLoading: boolean;
  streamingId: string | null;
  voiceStreamingId: string | null;
  limitReached: boolean;
  remaining: number | null;
  dailyLimit: number;
  isPremium: boolean;
  sendFinancePrompt: (raw: string) => Promise<string>;
  sendVoiceFinancePrompt: (raw: string) => Promise<string>;
  upgradePremium: () => void;
}

const FinanceAgentContext = createContext<FinanceAgentContextValue | null>(null);

function mergeHistoryForApi(
  chat: FinanceAgentMessage[],
  voice: VoiceThreadMessage[],
): FinanceAgentMessage[] {
  const voiceAsChat: FinanceAgentMessage[] = voice
    .filter((m) => m.text.trim())
    .map((m) => ({ id: m.id, role: m.role, text: m.text }));

  return [...chat.filter((m) => m.text.trim()), ...voiceAsChat];
}

export function FinanceAgentProvider({ children }: { children: ReactNode }) {
  const { upgradeToPremium } = useAuth();
  const {
    isPremium,
    remaining,
    dailyLimit,
    limitReached,
    recordSuccessfulPrompt,
  } = useAiFinanceUsage();

  const [messages, setMessages] = useState<FinanceAgentMessage[]>([GREETING]);
  const [voiceMessages, setVoiceMessages] = useState<VoiceThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [voiceStreamingId, setVoiceStreamingId] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  const voiceMessagesRef = useRef(voiceMessages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    voiceMessagesRef.current = voiceMessages;
  }, [voiceMessages]);

  const agentBusy = isLoading || isVoiceLoading;

  const sendFinancePrompt = useCallback(
    async (raw: string): Promise<string> => {
      const text = raw.trim();
      if (!text) throw new Error("Empty prompt");
      if (agentBusy) throw new Error("Finance agent is busy");
      if (limitReached) throw new Error("Daily AI limit reached");

      const userMsg: FinanceAgentMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text,
      };

      const assistantId = `assistant-${Date.now()}`;
      const historyForApi = mergeHistoryForApi(messagesRef.current, voiceMessagesRef.current);

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingId(assistantId);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

      try {
        let accumulated = "";
        const stream = streamFinanceAgentReply(historyForApi, text);

        for await (const chunk of stream) {
          accumulated += chunk;
          const snapshot = accumulated;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: snapshot } : m)),
          );
        }

        if (accumulated.trim()) {
          recordSuccessfulPrompt();
        }

        return accumulated.trim();
      } catch {
        toast.error("Finance agent unavailable — try again");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        throw new Error("Finance agent unavailable");
      } finally {
        setIsLoading(false);
        setStreamingId(null);
      }
    },
    [agentBusy, limitReached, recordSuccessfulPrompt],
  );

  const sendVoiceFinancePrompt = useCallback(
    async (raw: string): Promise<string> => {
      const text = raw.trim();
      if (!text) throw new Error("Empty prompt");
      if (agentBusy) throw new Error("Finance agent is busy");
      if (limitReached) throw new Error("Daily AI limit reached");

      const now = Date.now();
      const userMsg: VoiceThreadMessage = {
        id: `voice-user-${now}`,
        role: "user",
        text,
        timestamp: now,
      };

      const assistantId = `voice-assistant-${now}`;
      const historyForApi = mergeHistoryForApi(messagesRef.current, voiceMessagesRef.current);

      setVoiceMessages((prev) => [...prev, userMsg]);
      setIsVoiceLoading(true);
      setVoiceStreamingId(assistantId);
      setVoiceMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", timestamp: Date.now() },
      ]);

      try {
        let accumulated = "";
        const stream = streamFinanceAgentReply(historyForApi, text);

        for await (const chunk of stream) {
          accumulated += chunk;
          const snapshot = accumulated;
          setVoiceMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: snapshot } : m)),
          );
        }

        if (accumulated.trim()) {
          recordSuccessfulPrompt();
        }

        return accumulated.trim();
      } catch {
        toast.error("Finance agent unavailable — try again");
        setVoiceMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
        throw new Error("Finance agent unavailable");
      } finally {
        setIsVoiceLoading(false);
        setVoiceStreamingId(null);
      }
    },
    [agentBusy, limitReached, recordSuccessfulPrompt],
  );

  const upgradePremium = useCallback(() => {
    upgradeToPremium();
    toast.success("Welcome to Pivoton Premium — unlimited AI access unlocked");
  }, [upgradeToPremium]);

  return (
    <FinanceAgentContext.Provider
      value={{
        messages,
        voiceMessages,
        isLoading,
        isVoiceLoading,
        streamingId,
        voiceStreamingId,
        limitReached,
        remaining,
        dailyLimit,
        isPremium,
        sendFinancePrompt,
        sendVoiceFinancePrompt,
        upgradePremium,
      }}
    >
      {children}
    </FinanceAgentContext.Provider>
  );
}

export function useFinanceAgent(): FinanceAgentContextValue {
  const ctx = useContext(FinanceAgentContext);
  if (!ctx) {
    throw new Error("useFinanceAgent must be used within FinanceAgentProvider");
  }
  return ctx;
}

export { GREETING };
