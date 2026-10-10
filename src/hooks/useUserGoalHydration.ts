import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { goalQueryKeys } from "@/hooks/useGoalTracking";
import { markPostAsTracked, syncTrackedPostsForUser } from "@/lib/tracked-goals-store";
import { upsertGoalForUser } from "@/lib/user-goals-storage";
import {
  fetchUserGoalsWithDetails,
  syncLocalGoalsToSupabase,
} from "@/services/hope-goals";
import type { Goal } from "@/types/hope-goal";

/**
 * On login, refresh, or session restore: pull goals from Supabase + local cache,
 * rebuild tracked-post index, and warm React Query.
 */
export function useUserGoalHydration(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let cancelled = false;

    void (async () => {
      await syncLocalGoalsToSupabase(userId).catch(() => {
        // Best-effort remote sync for goals saved offline.
      });

      const goals = await fetchUserGoalsWithDetails(userId, []);
      if (cancelled) return;

      for (const goal of goals) {
        const row: Goal = {
          id: goal.id,
          user_id: goal.user_id,
          post_id: goal.post_id,
          title: goal.title,
          status: goal.status,
          created_at: goal.created_at,
        };
        upsertGoalForUser(row);
        markPostAsTracked(userId, goal.post_id);
      }

      syncTrackedPostsForUser(userId, goals.map((goal) => goal.post_id));

      queryClient.setQueryData(goalQueryKeys.userGoals(userId), goals);

      queryClient.setQueriesData<Goal[]>({ queryKey: ["goals-by-post-ids"] }, (current) => {
        const map = new Map<string, Goal>();
        for (const goal of current ?? []) map.set(`${goal.user_id}:${goal.post_id}`, goal);
        for (const goal of goals) {
          map.set(`${goal.user_id}:${goal.post_id}`, {
            id: goal.id,
            user_id: goal.user_id,
            post_id: goal.post_id,
            title: goal.title,
            status: goal.status,
            created_at: goal.created_at,
          });
        }
        return Array.from(map.values());
      });

      for (const goal of goals) {
        queryClient.setQueryData(goalQueryKeys.goalForPost(goal.post_id, userId), {
          id: goal.id,
          user_id: goal.user_id,
          post_id: goal.post_id,
          title: goal.title,
          status: goal.status,
          created_at: goal.created_at,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, queryClient]);
}
