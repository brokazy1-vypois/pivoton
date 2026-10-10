import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HopeFeedTimeline } from "@/components/hope-feed/HopeFeedTimeline";
import { HopePostCard } from "@/components/hope-feed/HopePostCard";
import { UserProfileActions } from "@/components/hope-feed/UserProfileActions";
import { UserProfileLink } from "@/components/hope-feed/UserProfileLink";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { HopePostComposer } from "@/components/hope-feed/HopePostComposer";
import { HopeImageMagnifierProvider } from "@/components/hope-feed/ImageCursorMagnifier";
import { FeedSubNav, type FeedViewTab } from "@/components/hope-feed/FeedSubNav";

const ContactSearchView = lazy(() =>
  import("@/components/hope-feed/ContactSearchView").then((m) => ({
    default: m.ContactSearchView,
  })),
);
const IdeaGalleryView = lazy(() =>
  import("@/components/ideation/IdeaGalleryView").then((m) => ({
    default: m.IdeaGalleryView,
  })),
);
import { useAuth } from "@/context/AuthContext";
import { profileFromPost } from "@/data/seed-hope-posts";
import { useFeedScrollSpy } from "@/hooks/useFeedScrollSpy";
import { groupCommentsByPost } from "@/lib/comment-tree";
import { cn } from "@/lib/utils";
import { fetchErpInventory } from "@/lib/pivoton-erp";
import {
  createHopePost,
  fetchHopeComments,
  fetchHopePosts,
  hopeQueryKeys,
  readHopePostsFromLocalStorage,
} from "@/services/hope-posts";
import { fetchGoalStatsForUsers } from "@/services/hope-goals";
import { markPostAsTracked, readTrackedPostIdsForUser } from "@/lib/tracked-goals-store";
import { goalQueryKeys, useUserGoalsWithDetails } from "@/hooks/useGoalTracking";
import { formatGoalsCompletedLabel, formatHopesLoggedLabel } from "@/lib/goal-stats";
import type { Goal, GoalWithDetails } from "@/types/hope-goal";
import type { HopeComment, HopePost, HopePostAttachment, HopeUserProfile } from "@/types/hope-post";

type FeedSearch = { tab?: FeedViewTab | "contact-search" | "ideas" };

export const Route = createFileRoute("/feed")({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    tab:
      search.tab === "ideas"
        ? "ideas"
        : search.tab === "contact-search"
          ? "contact-search"
          : "feed",
  }),
  head: () => ({
    meta: [
      { title: "Social Hope Feed — Pivoton Timeline" },
      {
        name: "description",
        content:
          "Post what you hope for and watch the thread branch. Pivoton renders every conversation as a tree diagram so long discussions stay readable.",
      },
      { property: "og:title", content: "Pivoton Social Hope Feed" },
      {
        property: "og:description",
        content: "Hope posts with tree-diagram comment threads, profiles, messaging and calling.",
      },
    ],
  }),
  component: Feed,
});

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatHopeStatus(status: HopePost["hope_status"]): string | null {
  if (!status) return null;
  return status === "in_progress" ? "in progress" : status;
}

function TabLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function Feed() {
  const { user, openAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const [commentsByPost, setCommentsByPost] = useState<Record<string, HopeComment[]>>({});
  const [isPosting, setIsPosting] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const { tab: activeView = "feed" } = Route.useSearch();
  const [goalsReady, setGoalsReady] = useState(false);

  const postsQuery = useQuery({
    queryKey: hopeQueryKeys.posts,
    queryFn: fetchHopePosts,
    placeholderData: () =>
      typeof window === "undefined" ? [] : readHopePostsFromLocalStorage(),
    staleTime: 30_000,
  });

  const commentsQuery = useQuery({
    queryKey: hopeQueryKeys.comments,
    queryFn: fetchHopeComments,
    staleTime: 30_000,
  });

  const posts = postsQuery.data ?? [];
  const isInitialLoad = postsQuery.isLoading && posts.length === 0;
  const isSyncing = postsQuery.isFetching && !postsQuery.isLoading;

  const catalogQuery = useQuery({
    queryKey: ["erp-inventory"],
    queryFn: fetchErpInventory,
    staleTime: 60_000,
  });
  const catalog = catalogQuery.data?.items ?? [];

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const userGoalsQuery = useUserGoalsWithDetails(
    user?.id ?? "",
    posts,
    Boolean(user?.id) && goalsReady,
  );

  const goalsByPostId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const goal of userGoalsQuery.data ?? []) {
      map.set(goal.post_id, true);
    }
    if (user?.id) {
      const postIdSet = new Set(postIds);
      for (const postId of readTrackedPostIdsForUser(user.id)) {
        if (postIdSet.has(postId)) map.set(postId, true);
      }
    }
    return map;
  }, [userGoalsQuery.data, user?.id, postIds]);

  const goalsWithDetailsByPostId = useMemo(() => {
    const map = new Map<string, GoalWithDetails>();
    for (const goal of userGoalsQuery.data ?? []) {
      map.set(goal.post_id, goal);
    }
    return map;
  }, [userGoalsQuery.data]);

  const { activePostId, setPostRef, refreshScrollSpy } = useFeedScrollSpy(postIds, layoutKey);

  const handleThreadLayoutChange = useCallback(() => {
    setLayoutKey((k) => k + 1);
    refreshScrollSpy();
  }, [refreshScrollSpy]);

  const activePost = useMemo(
    () => posts.find((p) => p.id === activePostId) ?? posts[0] ?? null,
    [posts, activePostId],
  );

  const activeProfile: HopeUserProfile | null = useMemo(
    () => (activePost ? profileFromPost(activePost) : null),
    [activePost],
  );

  const activePastHopes = useMemo(() => {
    if (!activePost) return [];
    return posts
      .filter((p) => p.user_id === activePost.user_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [posts, activePost]);

  const goalStatsQuery = useQuery({
    queryKey: ["user-goal-stats", activeProfile?.id ?? ""],
    queryFn: () =>
      activeProfile ? fetchGoalStatsForUsers([activeProfile.id]) : Promise.resolve({}),
    enabled: goalsReady && Boolean(activeProfile?.id),
    staleTime: 60_000,
  });

  const goalStatsByUser = goalStatsQuery.data ?? {};

  useEffect(() => {
    if (commentsQuery.data) {
      setCommentsByPost(groupCommentsByPost(commentsQuery.data));
    }
  }, [commentsQuery.data]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGoalsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleAddComment = useCallback(
    (postId: string, comment: HopeComment) => {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), comment],
      }));
      handleThreadLayoutChange();
    },
    [handleThreadLayoutChange],
  );

  const handleReplaceComment = useCallback((postId: string, tempId: string, saved: HopeComment) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) => (c.id === tempId ? saved : c)),
    }));
  }, []);

  const handleRemoveComment = useCallback((postId: string, tempId: string) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== tempId),
    }));
  }, []);

  const handlePostUpdated = useCallback(
    (updated: HopePost) => {
      queryClient.setQueryData<HopePost[]>(hopeQueryKeys.posts, (prev) =>
        (prev ?? []).map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      handleThreadLayoutChange();
    },
    [handleThreadLayoutChange, queryClient],
  );

  const handlePostDeleted = useCallback(
    (postId: string) => {
      queryClient.setQueryData<HopePost[]>(hopeQueryKeys.posts, (prev) =>
        (prev ?? []).filter((entry) => entry.id !== postId),
      );
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      handleThreadLayoutChange();
    },
    [handleThreadLayoutChange, queryClient],
  );

  const handleGoalConverted = useCallback(
    (goal: GoalWithDetails) => {
      if (!user?.id) return;
      const savedGoal: Goal = {
        id: goal.id,
        user_id: goal.user_id,
        post_id: goal.post_id,
        title: goal.title,
        status: goal.status,
        created_at: goal.created_at,
      };

      queryClient.setQueryData<GoalWithDetails[]>(
        goalQueryKeys.userGoals(user.id),
        (current) => {
          const list = current ?? [];
          return [goal, ...list.filter((item) => item.post_id !== goal.post_id)];
        },
      );

      queryClient.setQueriesData<Goal[]>({ queryKey: ["goals-by-post-ids"] }, (current) => {
        const list = current ?? [];
        return [savedGoal, ...list.filter((item) => item.post_id !== savedGoal.post_id)];
      });

      queryClient.setQueryData<Goal | null>(
        goalQueryKeys.goalForPost(goal.post_id, user.id),
        savedGoal,
      );

      markPostAsTracked(user.id, goal.post_id);
    },
    [queryClient, user?.id],
  );

  const handlePost = async (input: {
    content: string;
    attachments: HopePostAttachment[];
    marketplace_link: string | null;
    marketplace_links: string[];
  }) => {
    if (!user) {
      openAuthModal("Please sign in to post your hopes.");
      return;
    }

    setIsPosting(true);
    try {
      const post = await createHopePost({
        user_id: user.id,
        author_name: user.fullName,
        author_avatar: user.avatar,
        job_role: user.role ?? null,
        content: input.content,
        attachments: input.attachments,
        marketplace_link: input.marketplace_link,
        marketplace_links: input.marketplace_links,
      });
      queryClient.setQueryData<HopePost[]>(hopeQueryKeys.posts, (prev) => [post, ...(prev ?? [])]);
      toast.success("Hope posted to your timeline");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save your hope — try again", { description: message });
      throw error;
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <FeedSubNav activeTab={activeView} />

      {activeView === "ideas" ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <IdeaGalleryView
            currentUserId={user?.id}
            currentUserName={user?.fullName}
            currentUserAvatar={user?.avatar}
            onRequireAuth={() => openAuthModal("Sign in to rate and comment on ideas.")}
          />
        </Suspense>
      ) : activeView === "contact-search" ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <ContactSearchView
            posts={posts}
            commentsByPost={commentsByPost}
            user={user}
            isLoading={isInitialLoad}
          />
        </Suspense>
      ) : (
        <div className="grid grid-cols-12 gap-8">
          {/* Left — scrollable feed stream (~8 cols) */}
          <div className="col-span-12 lg:col-span-8">
            <h1 className="text-4xl font-semibold sm:text-5xl">Hope feed</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Every post begins with an intention — "I want", "I hope". Replies branch off the trunk so
              the whole conversation reads like a diagram, not a wall.
            </p>

            <HopeImageMagnifierProvider>
              <HopePostComposer
                userId={user?.id ?? null}
                isAuthenticated={Boolean(user)}
                isPosting={isPosting}
                catalog={catalog}
                catalogLoading={catalogQuery.isLoading}
                onRequireAuth={() => openAuthModal("Please sign in to post your hopes.")}
                onSubmit={handlePost}
              />

              <div className="mt-10 space-y-6">
                {isInitialLoad ? (
                  <p className="text-sm text-muted-foreground">Loading hopes…</p>
                ) : posts.length === 0 ? (
                  <p className="panel p-6 text-sm text-muted-foreground">
                    No hopes posted yet. Be the first to share an intention.
                  </p>
                ) : (
                  <>
                    {isSyncing ? (
                      <p className="text-xs text-muted-foreground">Syncing latest hopes…</p>
                    ) : null}
                    <HopeFeedTimeline
                      items={posts}
                      getKey={(post) => post.id}
                      renderItem={(post) => (
                        <HopePostCard
                          post={post}
                          catalog={catalog}
                          catalogLoading={catalogQuery.isLoading}
                          comments={commentsByPost[post.id] ?? []}
                          ref={setPostRef(post.id)}
                          isActive={post.id === activePostId}
                          currentUserId={user?.id ?? null}
                          onPostUpdated={handlePostUpdated}
                          onPostDeleted={handlePostDeleted}
                          onThreadLayoutChange={handleThreadLayoutChange}
                          onCommentAdded={(c) => handleAddComment(post.id, c)}
                          onCommentReplaced={(tempId, saved) =>
                            handleReplaceComment(post.id, tempId, saved)
                          }
                          onCommentRemoved={(tempId) => handleRemoveComment(post.id, tempId)}
                          goalForPost={goalsWithDetailsByPostId.get(post.id) ?? null}
                          initialGoalTracked={goalsByPostId.get(post.id) ?? false}
                          skipGoalLookup={Boolean(user?.id && goalsReady)}
                          onGoalConverted={handleGoalConverted}
                        />
                      )}
                    />
                  </>
                )}
              </div>
            </HopeImageMagnifierProvider>
          </div>

          {/* Right — sticky sidebar (~4 cols) */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="sticky top-24 h-fit space-y-6">
              <FeedProfileCard
                profile={activeProfile}
                hopeCount={activePastHopes.length}
                {...(activeProfile &&
                typeof goalStatsByUser[activeProfile.id]?.completed === "number"
                  ? { goalsCompletedCount: goalStatsByUser[activeProfile.id]!.completed }
                  : {})}
              />
              <PastHopesCard
                hopes={activePastHopes}
                profileName={activeProfile?.fullName}
                userId={activeProfile?.id}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function FeedProfileCard({
  profile,
  hopeCount,
  goalsCompletedCount,
}: {
  profile: HopeUserProfile | null;
  hopeCount: number;
  goalsCompletedCount?: number;
}) {
  if (!profile) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-muted-foreground">Scroll the feed to preview a member profile.</p>
      </div>
    );
  }

  return (
    <div
      key={profile.id}
      className="panel p-6 transition-all duration-300 animate-in fade-in-0 slide-in-from-right-2"
    >
      <UserProfileLink userId={profile.id} className="flex items-center gap-3 hover:text-inherit">
        <UserAvatar userId={profile.id} initials={profile.avatar} className="h-10 w-10 text-sm" />
        <div className="min-w-0 text-left">
          <h2 className="text-sm font-semibold transition-colors hover:text-primary">
            {profile.fullName}
          </h2>
          <p className="text-xs text-muted-foreground transition-colors hover:text-primary/80">
            {profile.job_role} · {formatHopesLoggedLabel(hopeCount)}
            {typeof goalsCompletedCount === "number" ? (
              <>
                {" · "}
                {formatGoalsCompletedLabel(goalsCompletedCount)}
              </>
            ) : null}
          </p>
        </div>
      </UserProfileLink>
      <UserProfileActions
        targetUserId={profile.id}
        fullName={profile.fullName}
        targetAvatar={profile.avatar}
        className="mt-5 grid gap-2"
      />
    </div>
  );
}

function PastHopesCard({
  hopes,
  profileName,
  userId,
}: {
  hopes: HopePost[];
  profileName?: string;
  userId?: string;
}) {
  return (
    <div
      key={profileName ?? "empty"}
      className="panel p-6 transition-all duration-300 animate-in fade-in-0 slide-in-from-right-2"
    >
      <h2 className="text-sm font-semibold">Past hopes</h2>
      {hopes.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No posting history for this member.</p>
      ) : !userId ? (
        <p className="mt-4 text-xs text-muted-foreground">Scroll the feed to preview past hopes.</p>
      ) : (
        <ul className="custom-scrollbar mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-xs leading-relaxed text-muted-foreground">
          {hopes.map((hope) => {
            const status = formatHopeStatus(hope.hope_status);
            const preview =
              hope.content.length > 96 ? `${hope.content.slice(0, 96)}…` : hope.content;

            return (
              <li key={hope.id}>
                <Link
                  to="/profile/$userId"
                  params={{ userId }}
                  search={{ postId: hope.id }}
                  hash={`post-${hope.id}`}
                  className={cn(
                    "block cursor-pointer rounded-md px-1 -mx-1 py-0.5 transition-colors",
                    "hover:text-foreground hover:underline hover:underline-offset-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  )}
                >
                  {preview}
                  {status ? (
                    <span className="text-primary"> · {status}</span>
                  ) : (
                    <span className="text-primary/70"> · {formatTimeAgo(hope.created_at)} ago</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
