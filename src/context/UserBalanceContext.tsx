import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getUserBalance } from "@/services/user-balances";
import type { UserBalance } from "@/types/shop-commerce";

interface UserBalanceContextValue {
  balance: UserBalance | null;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
}

const UserBalanceContext = createContext<UserBalanceContextValue | null>(null);

export function UserBalanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const balanceQuery = useQuery({
    queryKey: ["user-balance", user?.id],
    queryFn: () => getUserBalance(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 5_000,
  });

  const refreshBalance = useCallback(async () => {
    if (!user?.id) return;
    await queryClient.invalidateQueries({ queryKey: ["user-balance", user.id] });
  }, [queryClient, user?.id]);

  const value = useMemo(
    () => ({
      balance: balanceQuery.data ?? null,
      isLoading: balanceQuery.isLoading,
      refreshBalance,
    }),
    [balanceQuery.data, balanceQuery.isLoading, refreshBalance],
  );

  return <UserBalanceContext.Provider value={value}>{children}</UserBalanceContext.Provider>;
}

export function useUserBalance() {
  const ctx = useContext(UserBalanceContext);
  if (!ctx) {
    throw new Error("useUserBalance must be used within UserBalanceProvider");
  }
  return ctx;
}
