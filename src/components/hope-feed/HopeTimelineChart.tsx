import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { HopeAttachedProductsWidget } from "@/components/hope-feed/HopeAttachedProductsWidget";
import {
  HopePostMediaRow,
  renderHopePostText,
  resolveHopePostCatalogProducts,
} from "@/components/hope-feed/HopePostMediaRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleGoalMilestone } from "@/services/hope-goals";
import type { GoalWithDetails } from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";
import type { ErpInventoryItem } from "@/types/erp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface HopeTimelineChartProps {
  goals: GoalWithDetails[];
  posts: HopePost[];
  catalog: ErpInventoryItem[];
  currentUserId?: string | null;
  profileUserId: string;
  onGoalsChange?: (goals: GoalWithDetails[]) => void;
}

function formatGoalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HopeTimelineChart({
  goals,
  posts,
  catalog,
  currentUserId,
  profileUserId,
  onGoalsChange,
}: HopeTimelineChartProps) {
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(goals[0]?.id ?? null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const isOwnProfile = currentUserId === profileUserId;

  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);

  const handleToggleExpand = (goalId: string) => {
    setExpandedGoalId((current) => (current === goalId ? null : goalId));
  };

  const handleMilestoneToggle = async (goalId: string, milestoneId: string, checked: boolean) => {
    if (!isOwnProfile || togglingId) return;

    setTogglingId(milestoneId);
    try {
      await toggleGoalMilestone(milestoneId, checked);
      const nextGoals = goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        const milestones = goal.milestones.map((milestone) =>
          milestone.id === milestoneId
            ? {
                ...milestone,
                is_completed: checked,
                completed_at: checked ? new Date().toISOString() : null,
              }
            : milestone,
        );
        const allComplete =
          milestones.length > 0 && milestones.every((milestone) => milestone.is_completed);
        return {
          ...goal,
          milestones,
          status: allComplete ? "completed" : "in_progress",
        };
      });
      onGoalsChange?.(nextGoals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update milestone.");
    } finally {
      setTogglingId(null);
    }
  };

  if (goals.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <Target className="mx-auto h-8 w-8 text-muted-foreground/70" />
        <p className="mt-3 text-sm font-medium">No goals logged yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwnProfile
            ? 'Open a hope post and click "Log as Goal" to start your vertical timeline.'
            : "This member has not converted any hopes into goals yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Goal timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track hopes converted into goals with AI-guided next steps.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          {goals.filter((goal) => goal.status === "in_progress").length} active
        </Badge>
      </div>

      <div className="relative space-y-0">
        {goals.map((goal, index) => {
          const expanded = expandedGoalId === goal.id;
          const post = goal.post ?? postById.get(goal.post_id) ?? null;
          const completedCount = goal.milestones.filter((milestone) => milestone.is_completed).length;
          const attachedProducts = post
            ? resolveHopePostCatalogProducts(
                {
                  content: post.content,
                  marketplace_link: post.marketplace_link,
                  marketplace_links: post.marketplace_links,
                },
                catalog,
              )
            : [];

          return (
            <div key={goal.id} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleToggleExpand(goal.id)}
                  className={cn(
                    "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300",
                    expanded
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                      : goal.status === "completed"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                        : "border-border bg-surface-2 text-muted-foreground hover:border-emerald-500/40",
                  )}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} goal ${goal.title}`}
                >
                  {goal.status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                </button>
                {index < goals.length - 1 && (
                  <div
                    className={cn(
                      "my-1 min-h-10 w-px flex-1 transition-colors duration-300",
                      goal.status === "completed" ? "bg-emerald-500/60" : "bg-border",
                    )}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-8">
                <button
                  type="button"
                  onClick={() => handleToggleExpand(goal.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-surface-2/40"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{formatGoalDate(goal.created_at)}</p>
                    <p className="mt-0.5 text-sm font-semibold">{goal.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {completedCount}/{goal.milestones.length} milestones
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                      expanded && "rotate-180 text-emerald-400",
                    )}
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-[#0B1120]/80 p-4">
                      {post && (
                        <section>
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                            Original hope
                          </p>
                          <p className="mt-2 text-sm leading-relaxed">
                            {renderHopePostText(post.content)}
                          </p>
                          <HopePostMediaRow
                            attachments={post.attachments}
                            imageUrls={post.image_urls}
                          />
                          {attachedProducts.length > 0 && (
                            <div className="mt-3">
                              <HopeAttachedProductsWidget products={attachedProducts} />
                            </div>
                          )}
                        </section>
                      )}

                      <section>
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                          Milestones
                        </p>
                        <ul className="mt-3 space-y-2">
                          {goal.milestones.map((milestone) => (
                            <li
                              key={milestone.id}
                              className="flex items-start gap-3 rounded-lg border border-border/50 bg-surface-2/30 px-3 py-2"
                            >
                              {isOwnProfile ? (
                                <Checkbox
                                  checked={milestone.is_completed}
                                  disabled={togglingId === milestone.id}
                                  onCheckedChange={(value) =>
                                    void handleMilestoneToggle(
                                      goal.id,
                                      milestone.id,
                                      value === true,
                                    )
                                  }
                                  className="mt-0.5"
                                />
                              ) : (
                                <span
                                  className={cn(
                                    "mt-0.5 grid h-4 w-4 place-items-center rounded border",
                                    milestone.is_completed
                                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                      : "border-border",
                                  )}
                                >
                                  {milestone.is_completed ? (
                                    <Check className="h-3 w-3" />
                                  ) : null}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-sm",
                                    milestone.is_completed && "text-muted-foreground line-through",
                                  )}
                                >
                                  {milestone.title}
                                </p>
                                {milestone.completed_at && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    Done {formatGoalDate(milestone.completed_at)}
                                  </p>
                                )}
                              </div>
                              {togglingId === milestone.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>

                      {goal.guidance && (
                        <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
                          <div className="flex items-center gap-2 text-emerald-400">
                            <Sparkles className="h-4 w-4" />
                            <p className="text-xs font-medium uppercase tracking-wide">
                              AI instruction brief
                            </p>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                            {goal.guidance.instruction_text}
                          </p>
                          <div className="mt-3 rounded-md border border-emerald-500/20 bg-[#0B1120] px-3 py-2">
                            <p className="text-xs text-muted-foreground">Suggested next step</p>
                            <p className="mt-1 text-sm font-medium text-emerald-300">
                              {goal.guidance.suggested_next_step}
                            </p>
                          </div>
                        </section>
                      )}

                      {isOwnProfile && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleExpand(goal.id)}
                          >
                            Collapse
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
