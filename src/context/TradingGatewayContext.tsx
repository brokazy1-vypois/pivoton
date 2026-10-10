import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { getTradingGateway } from "@/data/trading-gateways";
import type { GatewayConnectionStatus } from "@/types/trading-gateway";

const STORAGE_PREFIX = "pivoton-connected-gateways";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}_${userId}`;
}

function loadConnectedGatewayIds(userId: string | undefined): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveConnectedGatewayIds(userId: string, gatewayIds: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(gatewayIds));
}

interface TradingGatewayContextValue {
  connectedGatewayIds: string[];
  /** Connected gateway display names for guardrails and allocation UI. */
  userConnectedGateways: string[];
  connectingGatewayId: string | null;
  getGatewayStatus: (gatewayId: string) => GatewayConnectionStatus;
  beginConnect: (gatewayId: string) => void;
  completeConnect: (gatewayId: string) => void;
  cancelConnect: () => void;
  disconnectGateway: (gatewayId: string) => void;
  pendingConnectGatewayId: string | null;
  setPendingConnectGatewayId: (gatewayId: string | null) => void;
}

const TradingGatewayContext = createContext<TradingGatewayContextValue | null>(null);

export function TradingGatewayProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connectedGatewayIds, setConnectedGatewayIds] = useState<string[]>(() =>
    loadConnectedGatewayIds(user?.id),
  );
  const [connectingGatewayId, setConnectingGatewayId] = useState<string | null>(null);
  const [pendingConnectGatewayId, setPendingConnectGatewayId] = useState<string | null>(null);

  useEffect(() => {
    setConnectedGatewayIds(loadConnectedGatewayIds(user?.id));
    setConnectingGatewayId(null);
    setPendingConnectGatewayId(null);
  }, [user?.id]);

  const persistConnected = useCallback(
    (next: string[]) => {
      setConnectedGatewayIds(next);
      if (user?.id) saveConnectedGatewayIds(user.id, next);
    },
    [user?.id],
  );

  const getGatewayStatus = useCallback(
    (gatewayId: string): GatewayConnectionStatus => {
      if (connectingGatewayId === gatewayId) return "connecting";
      if (connectedGatewayIds.includes(gatewayId)) return "connected";
      return "not_connected";
    },
    [connectedGatewayIds, connectingGatewayId],
  );

  const beginConnect = useCallback((gatewayId: string) => {
    setConnectingGatewayId(gatewayId);
    setPendingConnectGatewayId(gatewayId);
  }, []);

  const completeConnect = useCallback(
    (gatewayId: string) => {
      if (!connectedGatewayIds.includes(gatewayId)) {
        persistConnected([...connectedGatewayIds, gatewayId]);
      }
      setConnectingGatewayId(null);
      setPendingConnectGatewayId(null);
    },
    [connectedGatewayIds, persistConnected],
  );

  const cancelConnect = useCallback(() => {
    setConnectingGatewayId(null);
    setPendingConnectGatewayId(null);
  }, []);

  const disconnectGateway = useCallback(
    (gatewayId: string) => {
      persistConnected(connectedGatewayIds.filter((id) => id !== gatewayId));
    },
    [connectedGatewayIds, persistConnected],
  );

  const userConnectedGateways = useMemo(
    () =>
      connectedGatewayIds
        .map((id) => getTradingGateway(id)?.name)
        .filter((name): name is string => Boolean(name)),
    [connectedGatewayIds],
  );

  const value = useMemo<TradingGatewayContextValue>(
    () => ({
      connectedGatewayIds,
      userConnectedGateways,
      connectingGatewayId,
      getGatewayStatus,
      beginConnect,
      completeConnect,
      cancelConnect,
      disconnectGateway,
      pendingConnectGatewayId,
      setPendingConnectGatewayId,
    }),
    [
      beginConnect,
      cancelConnect,
      completeConnect,
      connectedGatewayIds,
      connectingGatewayId,
      disconnectGateway,
      getGatewayStatus,
      pendingConnectGatewayId,
      userConnectedGateways,
    ],
  );

  return (
    <TradingGatewayContext.Provider value={value}>{children}</TradingGatewayContext.Provider>
  );
}

export function useTradingGateways() {
  const ctx = useContext(TradingGatewayContext);
  if (!ctx) {
    throw new Error("useTradingGateways must be used within TradingGatewayProvider");
  }
  return ctx;
}
