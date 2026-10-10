import { type MouseEvent, useEffect, useState } from "react";
import { Check, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatUnknownError } from "@/lib/utils";
import { useIsPostTracked } from "@/lib/tracked-goals-store";
import {
  useGoalForPost,
  useTrackGoalMutation,
} from "@/hooks/useGoalTracking";
import type { GoalWithDetails } from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";

export interface GoalTrackButtonProps {
  post: HopePost;
  currentUserId?: string | null;
  attachedProductNames?: string[];
  /** Optional seed from parent list queries — merged with global React Query cache. */
  initialIsTracked?: boolean;
  /** When true, parent batch query already covers goal lookup for this post. */
  skipGoalLookup?: boolean;
  /** Cache-only callback — must not trigger navigation. */
  onConverted?: (goal: GoalWithDetails) => void;
  className?: string;
}

export function GoalTrackButton({
  post,
  currentUserId,
  attachedProductNames = [],
  initialIsTracked = false,
  skipGoalLookup = false,
  onConverted,
  className,
}: GoalTrackButtonProps) {
  const isAuthor = Boolean(currentUserId && currentUserId === post.user_id);
  const isTrackedInStore = useIsPostTracked(isAuthor ? currentUserId : null, post.id);
  const { data: trackedGoal, isLoading: goalLoading } = useGoalForPost(
    post.id,
    isAuthor ? currentUserId : null,
    {
      enabled:
        isAuthor &&
        !skipGoalLookup &&
        !initialIsTracked &&
        !isTrackedInStore,
    },
  );
  const trackMutation = useTrackGoalMutation();
  const [justTracked, setJustTracked] = useState(false);

  useEffect(() => {
    if (!justTracked) return;
    const timer = window.setTimeout(() => setJustTracked(false), 1200);
    return () => window.clearTimeout(timer);
  }, [justTracked]);

  if (!isAuthor) return null;

  const isTracked = isTrackedInStore || Boolean(trackedGoal) || initialIsTracked;
  const isPending =
    trackMutation.isPending || (goalLoading && !isTrackedInStore && !initialIsTracked);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUserId || isPending) return;

    if (isTracked) {
      toast.info("This hope is already tracked as a goal.");
      return;
    }

    trackMutation.mutate(
      {
        userId: currentUserId,
        post,
        attachedProductNames,
      },
      {
        onSuccess: (goal) => {
          setJustTracked(true);
          onConverted?.(goal);
          toast.success("Hope logged as a goal!", {
            description: "Marked as Goal tracked — you're still on this page.",
          });
        },
        onError: (error) => {
          toast.error(formatUnknownError(error, "Could not convert this hope to a goal."));
        },
      },
    );
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      aria-pressed={isTracked}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
        isTracked
          ? "border border-primary/35 bg-primary/15 text-primary backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_-6px_rgba(16,185,129,0.45)]"
          : "border border-white/20 bg-white/8 text-foreground backdrop-blur-md hover:border-white/30 hover:bg-white/12",
        justTracked && "animate-in zoom-in-95 duration-300",
        className,
      )}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isTracked && justTracked ? (
        <Check className="h-3.5 w-3.5 animate-in zoom-in duration-300" />
      ) : (
        <Target className={cn("h-3.5 w-3.5", isTracked && "text-primary")} />
      )}
      {isTracked ? "Goal tracked" : "Log as Goal"}
    </button>
  );
}

/** @deprecated Use `GoalTrackButton` */
export { GoalTrackButton as LogAsGoalButton };
