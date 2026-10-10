import { useCallback, useEffect, useMemo, useState } from "react";
import { PrototypeSandbox } from "@/components/ideation/PrototypeSandbox";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiById } from "@/data/ideation-api-catalog";
import { cn } from "@/lib/utils";
import {
  addPrototypeComment,
  fetchPrototypeComments,
  getUserRatingForPrototype,
  rateIdeationPrototype,
} from "@/services/ideation-prototypes";
import type { IdeationComment, IdeationPrototype } from "@/types/ideation";

interface IdeaCardProps {
  prototype: IdeationPrototype;
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserAvatar?: string;
  onRequireAuth?: () => void;
  onUpdated?: (prototype: IdeationPrototype) => void;
  compactPreview?: boolean;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function IdeaCard({
  prototype,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onRequireAuth,
  onUpdated,
  compactPreview = false,
}: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<IdeationComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(() =>
    currentUserId ? getUserRatingForPrototype(prototype.id, currentUserId) : null,
  );
  const [localPrototype, setLocalPrototype] = useState(prototype);

  useEffect(() => {
    setLocalPrototype(prototype);
  }, [prototype]);

  const averageRating = useMemo(() => {
    if (localPrototype.rating_count === 0) return 0;
    return localPrototype.rating_sum / localPrototype.rating_count;
  }, [localPrototype.rating_count, localPrototype.rating_sum]);

  const loadComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const data = await fetchPrototypeComments(localPrototype.id);
      setComments(data);
    } catch {
      toast.error("Could not load comments.");
    } finally {
      setIsLoadingComments(false);
    }
  }, [localPrototype.id]);

  useEffect(() => {
    if (expanded) void loadComments();
  }, [expanded, loadComments]);

  const handleRate = async (rating: number) => {
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    try {
      const updated = await rateIdeationPrototype(localPrototype.id, currentUserId, rating);
      setLocalPrototype(updated);
      setUserRating(rating);
      onUpdated?.(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit rating.");
    }
  };

  const handleComment = async () => {
    if (!commentInput.trim()) return;
    if (!currentUserId || !currentUserName) {
      onRequireAuth?.();
      return;
    }
    setIsSubmittingComment(true);
    try {
      const saved = await addPrototypeComment({
        prototype_id: localPrototype.id,
        user_id: currentUserId,
        author_name: currentUserName,
        author_avatar: currentUserAvatar ?? null,
        content: commentInput,
      });
      setComments((prev) => [...prev, saved]);
      setCommentInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#1e293b]">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-100">{localPrototype.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{localPrototype.description}</p>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => void handleRate(star)}
                className="rounded p-0.5 transition-colors hover:bg-slate-800"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    (userRating ?? 0) >= star || averageRating >= star - 0.25
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-600",
                  )}
                />
              </button>
            ))}
            <span className="ml-1 text-xs text-slate-500">
              {localPrototype.rating_count > 0
                ? `${averageRating.toFixed(1)} (${localPrototype.rating_count})`
                : "No ratings"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/profile/$userId"
            params={{ userId: localPrototype.user_id }}
            search={{ tab: "ideas" }}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-cyan-300"
          >
            <UserAvatar
              userId={localPrototype.user_id}
              initials={
                localPrototype.author_avatar ??
                localPrototype.author_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
              }
              className="h-7 w-7 text-xs"
            />
            <span>{localPrototype.author_name}</span>
          </Link>
          <span className="text-xs text-slate-500">
            {formatTimeAgo(localPrototype.published_at ?? localPrototype.updated_at)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {localPrototype.recommended_api_ids.map((apiId) => {
            const api = getApiById(apiId);
            return (
              <span
                key={apiId}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300"
              >
                {api?.logoEmoji ?? "🔌"} {api?.name ?? apiId}
              </span>
            );
          })}
          {localPrototype.monetization_tier === "active" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              Monetizable
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative border-t border-slate-700/60 bg-slate-950",
          compactPreview ? "h-48" : "h-64 sm:h-80",
        )}
      >
        <PrototypeSandbox
          html={localPrototype.html_preview}
          codeBundle={localPrototype.code_bundle}
          envVars={localPrototype.env_vars}
          title={`Preview: ${localPrototype.title}`}
          className="h-full"
          emptyMessage="No interactive preview available"
        />
      </div>

      <div className="border-t border-slate-700/60 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-sm text-slate-300 hover:text-slate-100"
        >
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Reviews & comments
            {comments.length > 0 && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {comments.length}
              </span>
            )}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {isLoadingComments ? (
              <p className="text-xs text-slate-500">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-500">No comments yet. Be the first to share feedback.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        userId={comment.user_id}
                        initials={
                          comment.author_avatar ??
                          comment.author_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                        }
                        className="h-6 w-6 text-[10px]"
                      />
                      <span className="text-xs font-medium text-slate-300">{comment.author_name}</span>
                      <span className="text-[10px] text-slate-500">
                        {formatTimeAgo(comment.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{comment.content}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <Input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Share feedback on this prototype…"
                className="border-slate-600 bg-slate-900/80 text-sm text-slate-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleComment();
                }}
              />
              <Button
                size="sm"
                disabled={!commentInput.trim() || isSubmittingComment}
                onClick={() => void handleComment()}
                className="shrink-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                Post
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
