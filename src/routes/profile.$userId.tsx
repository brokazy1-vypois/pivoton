import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lightbulb, Loader2, Wand2 } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { HopePostCard } from "@/components/hope-feed/HopePostCard";
import { HopeFeedTimeline } from "@/components/hope-feed/HopeFeedTimeline";

const IdeationStudio = lazy(() =>
  import("@/components/ideation/IdeationStudio").then((m) => ({ default: m.IdeationStudio })),
);
const IdeaTimelinePanel = lazy(() =>
  import("@/components/ideation/IdeaTimelinePanel").then((m) => ({
    default: m.IdeaTimelinePanel,
  })),
);
const HorizontalBranchGoalTimeline = lazy(() =>
  import("@/components/hope-feed/HorizontalBranchGoalTimeline").then((m) => ({
    default: m.HorizontalBranchGoalTimeline,
  })),
);
import { HopeImageMagnifierProvider } from "@/components/hope-feed/ImageCursorMagnifier";
import { UserProfileHeader } from "@/components/hope-feed/UserProfileHeader";
import { ProfileConnectionsPanel } from "@/components/connections/ProfileConnectionsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useProfileAvatar } from "@/context/ProfileAvatarContext";
import { deriveUserHandle } from "@/lib/user-handle";
import { groupCommentsByPost } from "@/lib/comment-tree";
import { isGoalWithDetailsCompleted } from "@/lib/goal-stats";
import { fetchErpInventory } from "@/lib/pivoton-erp";
import {
  fetchHopeComments,
  fetchUserHopePosts,
  hopeQueryKeys,
  readUserHopePostsFromLocalStorage,
} from "@/services/hope-posts";
import { fetchUserAvatarGlb } from "@/services/user-map-profiles";
import { fetchUserProfile } from "@/services/user-profiles";
import { goalQueryKeys, useUserGoalsWithDetails } from "@/hooks/useGoalTracking";
import { isPostTracked, markPostAsTracked } from "@/lib/tracked-goals-store";
import type { HopeComment, HopePost } from "@/types/hope-post";
import type { Goal, GoalWithDetails } from "@/types/hope-goal";
import type { UserProfileView } from "@/types/user-profile";
import type { ProfileAvatarMedia } from "@/lib/profile-avatar-media";

function profileFromAuthUser(
  userId: string,
  fullName: string,
  avatar: string | undefined,
  role: string | undefined,
  hopeCount: number,
  joinDate: string | null,
  avatarMedia: ProfileAvatarMedia | null,
  goalsCompletedCount: number,
): UserProfileView {
  return {
    id: userId,
    fullName,
    handle: deriveUserHandle(fullName, userId),
    job_role: role ?? "Member",
    avatar: avatar ?? fullName.charAt(0).toUpperCase(),
    joinDate,
    hopeCount,
    goalsCompletedCount,
    avatarMedia,
  };
}

type ProfileSearch = {
  postId?: string;
  tab?: "timeline" | "goals" | "goal-tracker" | "connections" | "ideation" | "ideas";
};

const FOCUS_HIGHLIGHT_MS = 4000;

function ProfileTabFallback() {
  return (
    <div className="mt-6 flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

export const Route = createFileRoute("/profile/$userId")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    postId: typeof search.postId === "string" ? search.postId : undefined,
    tab:
      search.tab === "connections"
        ? "connections"
        : search.tab === "ideation"
          ? "ideation"
          : search.tab === "ideas"
            ? "ideas"
            : search.tab === "goals" || search.tab === "goal-tracker"
              ? "goals"
              : "timeline",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Member Profile — Pivoton Hope Feed` },
      {
        name: "description",
        content: `View hopes posted by this Pivoton member.`,
      },
    ],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { postId: targetPostId, tab: profileTab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const { getAvatarMedia, publishAvatarMedia } = useProfileAvatar();
  const [posts, setPosts] = useState<HopePost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, HopeComment[]>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(targetPostId ?? null);
  const [avatarGlbUrl, setAvatarGlbUrl] = useState<string | null>(null);
  const [avatarMedia, setAvatarMedia] = useState<ProfileAvatarMedia | null>(null);
  const queryClient = useQueryClient();

  const isOwnProfile = user?.id === userId;
  const profileAuthorName = isOwnProfile ? user?.fullName : undefined;

  const timelineQuery = useQuery({
    queryKey: hopeQueryKeys.userPosts(userId, profileAuthorName ?? null),
    queryFn: async () => {
      const [userPosts, comments] = await Promise.all([
        fetchUserHopePosts(userId, { authorName: profileAuthorName }),
        fetchHopeComments(),
      ]);
      return { posts: userPosts, commentsByPost: groupCommentsByPost(comments) };
    },
    placeholderData: () => {
      const cachedPosts = readUserHopePostsFromLocalStorage(userId, profileAuthorName);
      if (cachedPosts.length === 0) return undefined;
      return { posts: cachedPosts, commentsByPost: {} as Record<string, HopeComment[]> };
    },
    enabled: Boolean(userId) && !authLoading,
    staleTime: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: ["user-profile", userId, user?.id === userId ? user.fullName : null],
    queryFn: () =>
      fetchUserProfile(userId, {
        authFallback:
          user?.id === userId
            ? {
                fullName: user.fullName,
                avatar: user.avatar,
                jobRole: user.role ?? "Member",
              }
            : undefined,
        posts: timelineQuery.data?.posts ?? [],
        authorName: profileAuthorName,
      }),
    enabled: Boolean(userId) && !authLoading,
    staleTime: 60_000,
  });

  const goalsQuery = useUserGoalsWithDetails(
    userId,
    timelineQuery.data?.posts ?? [],
    Boolean(timelineQuery.data),
  );

  const goals = goalsQuery.data ?? [];

  const catalogQuery = useQuery({
    queryKey: ["erp-inventory"],
    queryFn: fetchErpInventory,
    staleTime: 60_000,
  });

  const avatarGlbQuery = useQuery({
    queryKey: ["user-avatar-glb", userId],
    queryFn: () => fetchUserAvatarGlb(userId),
    enabled: Boolean(userId),
    staleTime: 120_000,
  });

  const profile = profileQuery.data ?? null;
  const catalog = catalogQuery.data?.items ?? [];
  const timelineLoading = timelineQuery.isLoading;
  const timelineError = timelineQuery.isError;
  const timelineReady = timelineQuery.isSuccess;
  const isLoading =
    authLoading ||
    (profileQuery.isLoading && !profileQuery.data) ||
    (timelineLoading && !timelineQuery.data);

  const joinDateFromPosts = useMemo(() => {
    if (posts.length === 0) return null;
    return posts.reduce((earliest, post) => {
      return new Date(post.created_at).getTime() < new Date(earliest).getTime()
        ? post.created_at
        : earliest;
    }, posts[0].created_at);
  }, [posts]);

  const resolvedAvatarMedia = getAvatarMedia(userId) ?? avatarMedia;

  const goalsCompletedCount = useMemo(
    () => goals.filter(isGoalWithDetailsCompleted).length,
    [goals],
  );

  const effectiveProfile = useMemo((): UserProfileView | null => {
    if (profile) {
      const synced = { ...profile, hopeCount: posts.length, goalsCompletedCount };
      return resolvedAvatarMedia ? { ...synced, avatarMedia: resolvedAvatarMedia } : synced;
    }
    if (user?.id !== userId) return null;
    return profileFromAuthUser(
      userId,
      user.fullName,
      user.avatar,
      user.role,
      posts.length,
      joinDateFromPosts,
      resolvedAvatarMedia,
      goalsCompletedCount,
    );
  }, [
    profile,
    user,
    userId,
    posts.length,
    joinDateFromPosts,
    resolvedAvatarMedia,
    goalsCompletedCount,
  ]);

  useEffect(() => {
    if (!timelineQuery.data) return;
    setPosts(timelineQuery.data.posts);
    setCommentsByPost(timelineQuery.data.commentsByPost);
  }, [timelineQuery.data]);

  useEffect(() => {
    setAvatarGlbUrl(avatarGlbQuery.data ?? null);
  }, [avatarGlbQuery.data]);

  useEffect(() => {
    setAvatarMedia(profile?.avatarMedia ?? null);
  }, [profile?.avatarMedia]);

  useEffect(() => {
    if (!targetPostId) {
      setFocusedPostId(null);
      return;
    }

    setFocusedPostId(targetPostId);
    const clearHighlight = window.setTimeout(() => {
      setFocusedPostId(null);
    }, FOCUS_HIGHLIGHT_MS);

    return () => window.clearTimeout(clearHighlight);
  }, [targetPostId]);

  useEffect(() => {
    if (!targetPostId || isLoading) return;

    const postExists = posts.some((post) => post.id === targetPostId);
    if (!postExists) return;

    const scrollTarget = document.getElementById(`post-${targetPostId}`);
    if (!scrollTarget) return;

    const frame = window.requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetPostId, isLoading, posts]);

  const handleThreadLayoutChange = useCallback(() => {}, []);

  const handlePostUpdated = useCallback((updated: HopePost) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handleAddComment = useCallback((postId: string, comment: HopeComment) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), comment],
    }));
  }, []);

  const handleReplaceComment = useCallback(
    (postId: string, tempId: string, saved: HopeComment) => {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === tempId ? saved : c)),
      }));
    },
    [],
  );

  const handleRemoveComment = useCallback((postId: string, tempId: string) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== tempId),
    }));
  }, []);

  const handleAvatarGlbSaved = useCallback((url: string) => {
    setAvatarGlbUrl(url);
  }, []);

  const handleAvatarMediaSaved = useCallback(
    (media: ProfileAvatarMedia) => {
      setAvatarMedia(media);
      publishAvatarMedia(userId, media);
    },
    [publishAvatarMedia, userId],
  );

  const handleGoalConverted = useCallback(
    (goal: GoalWithDetails) => {
      const savedGoal: Goal = {
        id: goal.id,
        user_id: goal.user_id,
        post_id: goal.post_id,
        title: goal.title,
        status: goal.status,
        created_at: goal.created_at,
      };

      queryClient.setQueryData<GoalWithDetails[]>(goalQueryKeys.userGoals(userId), (current) => {
        const list = current ?? [];
        return [goal, ...list.filter((item) => item.post_id !== goal.post_id)];
      });

      queryClient.setQueriesData<Goal[]>({ queryKey: ["goals-by-post-ids"] }, (current) => {
        const list = current ?? [];
        return [savedGoal, ...list.filter((item) => item.post_id !== savedGoal.post_id)];
      });

      queryClient.setQueryData<Goal | null>(
        goalQueryKeys.goalForPost(goal.post_id, userId),
        savedGoal,
      );

      markPostAsTracked(userId, goal.post_id);
    },
    [queryClient, userId],
  );

  const handleGoalsChange = useCallback(
    (nextGoals: GoalWithDetails[]) => {
      queryClient.setQueryData(goalQueryKeys.userGoals(userId), nextGoals);
    },
    [queryClient, userId],
  );

  const goalsByPostId = useMemo(() => {
    const map = new Map<string, GoalWithDetails>();
    for (const goal of goals) {
      map.set(goal.post_id, goal);
    }
    return map;
  }, [goals]);

  const isPostGoalTracked = useCallback(
    (postId: string) =>
      goalsByPostId.has(postId) ||
      (isOwnProfile && isPostTracked(userId, postId)),
    [goalsByPostId, isOwnProfile, userId],
  );

  const notFound = !isLoading && !effectiveProfile;
  const activeTab = profileTab ?? "timeline";

  return (
    <div
      className={cn(
        "mx-auto px-5 py-16",
        activeTab === "ideation" || activeTab === "ideas" ? "max-w-7xl" : "max-w-3xl",
      )}
    >
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link to="/feed">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to feed
        </Link>
      </Button>

      {isLoading && (
        <div className="space-y-6">
          <ProfileHeaderSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      )}

      {notFound && (
        <div className="panel p-8 text-center">
          <h1 className="text-xl font-semibold">Member not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This profile does not exist or has no posting history yet.
          </p>
          <Button asChild className="mt-6" variant="secondary">
            <Link to="/feed">Return to feed</Link>
          </Button>
        </div>
      )}

      {!isLoading && effectiveProfile && (
        <>
          <UserProfileHeader
            profile={effectiveProfile}
            isOwnProfile={isOwnProfile}
            avatarGlbUrl={avatarGlbUrl}
            avatarMedia={resolvedAvatarMedia}
            onAvatarGlbSaved={handleAvatarGlbSaved}
            onAvatarMediaSaved={handleAvatarMediaSaved}
          />

          <div className="mt-8 inline-flex rounded-full border border-border bg-surface-2/50 p-1">
            <Link
              to="/profile/$userId"
              params={{ userId }}
              search={{ tab: "timeline", postId: targetPostId }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                activeTab === "timeline"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hope timeline
            </Link>
            <Link
              to="/profile/$userId"
              params={{ userId }}
              search={{ tab: "goals" }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                activeTab === "goals"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Goal tracker
            </Link>
            {isOwnProfile && (
              <Link
                to="/profile/$userId"
                params={{ userId }}
                search={{ tab: "connections" }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  activeTab === "connections"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Connections
              </Link>
            )}
            {isOwnProfile && (
              <Link
                to="/profile/$userId"
                params={{ userId }}
                search={{ tab: "ideation" }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
                  activeTab === "ideation"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Ideation
              </Link>
            )}
            <Link
              to="/profile/$userId"
              params={{ userId }}
              search={{ tab: "ideas" }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
                activeTab === "ideas"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Ideas
            </Link>
          </div>

          {activeTab === "ideas" ? (
            <Suspense fallback={<ProfileTabFallback />}>
              <IdeaTimelinePanel
                userId={userId}
                userName={effectiveProfile.fullName}
                isOwnProfile={isOwnProfile}
                currentUserId={user?.id}
                currentUserName={user?.fullName}
                currentUserAvatar={user?.avatar}
                onRequireAuth={() => openAuthModal("Sign in to rate and comment on ideas.")}
              />
            </Suspense>
          ) : activeTab === "ideation" && isOwnProfile ? (
            <div className="mt-6 rounded-2xl border border-slate-700/60 bg-[#0f172a] p-6 sm:p-8">
              <Suspense fallback={<ProfileTabFallback />}>
                <IdeationStudio />
              </Suspense>
            </div>
          ) : activeTab === "connections" && isOwnProfile ? (
            <div className="mt-6">
              <h2 className="text-lg font-semibold">Connections</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage connected accounts and pending requests.
              </p>
              <div className="mt-6">
                <ProfileConnectionsPanel userId={userId} />
              </div>
            </div>
          ) : activeTab === "goals" ? (
            <div className="mt-10">
              <Suspense fallback={<ProfileTabFallback />}>
                <HorizontalBranchGoalTimeline
                  goals={goals}
                  posts={posts}
                  catalog={catalog}
                  currentUserId={user?.id ?? null}
                  profileUserId={userId}
                  onGoalsChange={handleGoalsChange}
                />
              </Suspense>
            </div>
          ) : (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Hope timeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All hopes posted by {effectiveProfile.fullName}, newest first.
            </p>

            <HopeImageMagnifierProvider>
              <div className="mt-6 space-y-6">
                {timelineLoading && posts.length === 0 ? (
                  <>
                    <PostSkeleton />
                    <PostSkeleton />
                  </>
                ) : timelineError ? (
                  <div className="panel p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Could not load hopes for this profile.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onClick={() => timelineQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="panel p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {effectiveProfile.fullName} has not posted any hopes yet.
                    </p>
                  </div>
                ) : (
                  <HopeFeedTimeline
                    items={posts}
                    getKey={(post) => post.id}
                    renderItem={(post) => (
                      <HopePostCard
                        post={post}
                        catalog={catalog}
                        catalogLoading={catalogQuery.isLoading}
                        comments={commentsByPost[post.id] ?? []}
                        isActive={false}
                        isFocused={post.id === focusedPostId}
                        currentUserId={user?.id ?? null}
                        onPostUpdated={handlePostUpdated}
                        onPostDeleted={handlePostDeleted}
                        onThreadLayoutChange={handleThreadLayoutChange}
                        onCommentAdded={(c) => handleAddComment(post.id, c)}
                        onCommentReplaced={(tempId, saved) =>
                          handleReplaceComment(post.id, tempId, saved)
                        }
                        onCommentRemoved={(tempId) => handleRemoveComment(post.id, tempId)}
                        goalForPost={goalsByPostId.get(post.id) ?? null}
                        initialGoalTracked={isPostGoalTracked(post.id)}
                        skipGoalLookup={Boolean(timelineReady)}
                        onGoalConverted={handleGoalConverted}
                      />
                    )}
                  />
                )}
              </div>
            </HopeImageMagnifierProvider>
          </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="panel flex gap-4 p-8">
      <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="panel space-y-4 p-7">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
