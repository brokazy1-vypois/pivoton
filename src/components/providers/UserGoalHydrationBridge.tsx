import { useAuth } from "@/context/AuthContext";
import { useUserGoalHydration } from "@/hooks/useUserGoalHydration";

/** Restores tracked goals from Supabase + local cache whenever auth session is available. */
export function UserGoalHydrationBridge() {
  const { user } = useAuth();
  useUserGoalHydration(user?.id ?? null);
  return null;
}
