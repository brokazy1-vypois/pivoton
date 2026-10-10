import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { markPostAsTracked } from "@/lib/tracked-goals-store";
import {
  convertHopePostToGoal,
  fetchGoalsByPostIds,
  fetchUserGoalsWithDetails,
  readLocalGoalForUserPost,
  readLocalGoalsForPostIds,
  readLocalUserGoalsWithDetails,
  upsertLocalGoal,
} from "@/services/hope-goals";
import type { ConvertHopePostToGoalInput, Goal, GoalWithDetails } from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";

/** Keep tracked goals in cache across route changes. */
const GOAL_QUERY_GC_TIME = 1000 * 60 * 30;
const GOAL_QUERY_STALE_TIME = 60_000;

const isClient = typeof window !== "undefined";

export const goalQueryKeys = {
  byPostIds: (postIds: string[]) =>
    ["goals-by-post-ids", [...postIds].sort().join(",")] as const,
  userGoals: (userId: string) => ["user-goals", userId] as const,
  goalForPost: (postId: string, userId: string) =>
    ["goal-for-post", postId, userId] as const,
};

function hydrateGoalsByPostIds(postIds: string[]): Goal[] | undefined {
  if (!isClient || postIds.length === 0) return undefined;
  const local = readLocalGoalsForPostIds(postIds);
  return local.length > 0 ? local : undefined;
}

function hydrateUserGoals(userId: string, posts: HopePost[]): GoalWithDetails[] | undefined {
  if (!isClient || !userId) return undefined;
  const local = readLocalUserGoalsWithDetails(userId, posts);
  return local.length > 0 ? local : undefined;
}

function resolveGoalForPost(postId: string, userId: string): Goal | null {
  return readLocalGoalForUserPost(userId, postId);
}

export function useGoalsByPostIds(postIds: string[], enabled = true) {
  return useQuery({
    queryKey: goalQueryKeys.byPostIds(postIds),
    queryFn: () => fetchGoalsByPostIds(postIds),
    enabled: isClient && enabled && postIds.length > 0,
    staleTime: GOAL_QUERY_STALE_TIME,
    gcTime: GOAL_QUERY_GC_TIME,
    refetchOnMount: true,
    placeholderData: (previous) => previous ?? hydrateGoalsByPostIds(postIds),
  });
}

export function useUserGoalsWithDetails(userId: string, posts: HopePost[], enabled = true) {
  return useQuery({
    queryKey: goalQueryKeys.userGoals(userId),
    queryFn: () => fetchUserGoalsWithDetails(userId, posts),
    enabled: isClient && enabled && Boolean(userId) && posts.length >= 0,
    staleTime: GOAL_QUERY_STALE_TIME,
    gcTime: GOAL_QUERY_GC_TIME,
    refetchOnMount: true,
    placeholderData: (previous) => previous ?? hydrateUserGoals(userId, posts),
  });
}

function upsertGoalInList(goals: Goal[] | undefined, goal: Goal): Goal[] {
  const list = goals ?? [];
  return [goal, ...list.filter((item) => item.post_id !== goal.post_id)];
}

function upsertGoalWithDetailsInList(
  goals: GoalWithDetails[] | undefined,
  goal: GoalWithDetails,
): GoalWithDetails[] {
  const list = goals ?? [];
  return [goal, ...list.filter((item) => item.post_id !== goal.post_id)];
}

function createOptimisticGoal(input: ConvertHopePostToGoalInput): GoalWithDetails {
  const now = new Date().toISOString();
  const goalId = `optimistic-${input.post.id}`;
  return {
    id: goalId,
    user_id: input.userId,
    post_id: input.post.id,
    title: input.post.content.slice(0, 80) || "New goal",
    status: "in_progress",
    created_at: now,
    milestones: [],
    guidance: null,
    post: input.post,
  };
}

function persistTrackedGoal(goal: Goal) {
  markPostAsTracked(goal.user_id, goal.post_id);
  upsertLocalGoal(goal);
}

function syncGoalCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  input: ConvertHopePostToGoalInput,
  goal: GoalWithDetails,
) {
  const savedGoal: Goal = {
    id: goal.id,
    user_id: goal.user_id,
    post_id: goal.post_id,
    title: goal.title,
    status: goal.status,
    created_at: goal.created_at,
  };

  queryClient.setQueryData<GoalWithDetails[]>(
    goalQueryKeys.userGoals(input.userId),
    (current) => upsertGoalWithDetailsInList(current, goal),
  );

  queryClient.setQueriesData<Goal[]>({ queryKey: ["goals-by-post-ids"] }, (current) =>
    upsertGoalInList(current, savedGoal),
  );

  queryClient.setQueryData<Goal | null>(
    goalQueryKeys.goalForPost(input.post.id, input.userId),
    savedGoal,
  );
}

export function useTrackGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConvertHopePostToGoalInput) => convertHopePostToGoal(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: goalQueryKeys.userGoals(input.userId) });

      const optimistic = createOptimisticGoal(input);
      const optimisticGoal: Goal = {
        id: optimistic.id,
        user_id: optimistic.user_id,
        post_id: optimistic.post_id,
        title: optimistic.title,
        status: optimistic.status,
        created_at: optimistic.created_at,
      };

      persistTrackedGoal(optimisticGoal);

      const previousUserGoals = queryClient.getQueryData<GoalWithDetails[]>(
        goalQueryKeys.userGoals(input.userId),
      );

      syncGoalCaches(queryClient, input, optimistic);

      return { previousUserGoals, optimisticGoal };
    },
    onSuccess: (goal, input) => {
      persistTrackedGoal({
        id: goal.id,
        user_id: goal.user_id,
        post_id: goal.post_id,
        title: goal.title,
        status: goal.status,
        created_at: goal.created_at,
      });
      syncGoalCaches(queryClient, input, goal);
    },
    onError: (_error, input, context) => {
      if (context?.previousUserGoals) {
        queryClient.setQueryData(
          goalQueryKeys.userGoals(input.userId),
          context.previousUserGoals,
        );
      } else {
        queryClient.setQueryData<GoalWithDetails[]>(
          goalQueryKeys.userGoals(input.userId),
          (current) =>
            (current ?? []).filter((item) => item.post_id !== input.post.id),
        );
      }

      queryClient.setQueriesData<Goal[]>({ queryKey: ["goals-by-post-ids"] }, (current) =>
        (current ?? []).filter(
          (item) => !(item.post_id === input.post.id && item.user_id === input.userId),
        ),
      );

      queryClient.setQueryData<Goal | null>(
        goalQueryKeys.goalForPost(input.post.id, input.userId),
        () => resolveGoalForPost(input.post.id, input.userId),
      );
    },
  });
}

export function useGoalForPost(
  postId: string,
  userId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: goalQueryKeys.goalForPost(postId, userId ?? ""),
    queryFn: async () => {
      const goals = await fetchGoalsByPostIds([postId]);
      const remoteMatch = goals.find((goal) => goal.user_id === userId) ?? null;
      if (remoteMatch) return remoteMatch;
      if (userId) return resolveGoalForPost(postId, userId);
      return null;
    },
    enabled: isClient && Boolean(userId) && queryEnabled,
    staleTime: GOAL_QUERY_STALE_TIME,
    gcTime: GOAL_QUERY_GC_TIME,
    refetchOnMount: true,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;

      const cachedLists = queryClient.getQueriesData<Goal[]>({
        queryKey: ["goals-by-post-ids"],
      });
      for (const [, goals] of cachedLists) {
        const match = goals?.find(
          (goal) => goal.post_id === postId && goal.user_id === userId,
        );
        if (match) return match;
      }

      const userGoals = queryClient.getQueryData<GoalWithDetails[]>(
        goalQueryKeys.userGoals(userId ?? ""),
      );
      const fromUser = userGoals?.find((goal) => goal.post_id === postId);
      if (fromUser) {
        return {
          id: fromUser.id,
          user_id: fromUser.user_id,
          post_id: fromUser.post_id,
          title: fromUser.title,
          status: fromUser.status,
          created_at: fromUser.created_at,
        };
      }

      if (userId) {
        const local = resolveGoalForPost(postId, userId);
        if (local) return local;
      }

      return undefined;
    },
  });
}

export function useGoalsByPostIdMap(postIds: string[], userId: string | null | undefined) {
  const query = useGoalsByPostIds(postIds, Boolean(userId));

  const goalsByPostId = useMemo(() => {
    const map = new Map<string, Goal>();
    for (const goal of query.data ?? []) {
      if (goal.user_id === userId) map.set(goal.post_id, goal);
    }
    if (userId) {
      for (const goal of readLocalGoalsForPostIds(postIds)) {
        if (goal.user_id === userId) map.set(goal.post_id, goal);
      }
    }
    return map;
  }, [query.data, userId, postIds]);

  return { ...query, goalsByPostId };
}

export function useInvalidateGoalCaches() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ["goals-by-post-ids"] });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: goalQueryKeys.userGoals(userId) });
      }
      void queryClient.invalidateQueries({ queryKey: ["user-goal-stats"] });
    },
    [queryClient],
  );
}
