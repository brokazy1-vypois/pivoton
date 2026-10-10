import { Heart, MessageCircle, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { hopeEngagementScore } from "@/lib/hope-geo";
import type { HopePost } from "@/types/hope-post";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface TrendingHopesPanelProps {
  posts: HopePost[];
  replyCountByPost: Record<string, number>;
  selectedPostId: string | null;
  onSelectPost: (postId: string) => void;
  isLoading?: boolean;
}

export function TrendingHopesPanel({
  posts,
  replyCountByPost,
  selectedPostId,
  onSelectPost,
  isLoading,
}: TrendingHopesPanelProps) {
  return (
    <div className="panel flex h-full max-h-[calc(100vh-10rem)] flex-col p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Top Trending Hopes</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Highest engagement within the current map viewport.
      </p>

      <div className="custom-scrollbar mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Updating viewport…</p>
        ) : posts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hopes in this area yet. Pan the map to explore nearby activity.
          </p>
        ) : (
          posts.map((post) => {
            const replies = replyCountByPost[post.id] ?? 0;
            const score = hopeEngagementScore(post, replies);
            const preview =
              post.content.length > 110 ? `${post.content.slice(0, 110)}…` : post.content;

            return (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelectPost(post.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                  selectedPostId === post.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-surface-2/40 hover:border-primary/30 hover:bg-surface-2/70",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{post.author_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(post.created_at)} ago
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{preview}</p>
                {post.location_label && (
                  <p className="mt-1 text-[10px] text-primary/80">{post.location_label}</p>
                )}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post.likes_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {replies}
                  </span>
                  <span className="ml-auto font-medium text-primary">Score {score}</span>
                </div>
                <Link
                  to="/profile/$userId"
                  params={{ userId: post.user_id }}
                  search={{ postId: post.id }}
                  className="mt-2 inline-block text-[10px] text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open on profile →
                </Link>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
