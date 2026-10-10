import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { GoalDetailModal } from "@/components/hope-feed/GoalDetailModal";
import { StepBoxChain } from "@/components/hope-feed/StepBoxChain";
import { SiriWaveIconCircle } from "@/components/hope-feed/timeline-effects";
import { countVerifiedSteps, isGoalTrackerActive } from "@/lib/goal-tracker-state";
import { syncGoalToLocalCache } from "@/services/hope-goals";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GoalWithDetails } from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";
import type { ErpInventoryItem } from "@/types/erp";

interface HorizontalBranchGoalTimelineProps {
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

export function HorizontalBranchGoalTimeline({
  goals,
  catalog,
  currentUserId,
  profileUserId,
  onGoalsChange,
}: HorizontalBranchGoalTimelineProps) {
  const isOwnProfile = currentUserId === profileUserId;
  const [selectedGoal, setSelectedGoal] = useState<GoalWithDetails | null>(null);

  const sortedGoals = useMemo(
    () =>
      [...goals].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [goals],
  );

  const handleGoalUpdate = (updated: GoalWithDetails) => {
    syncGoalToLocalCache(updated);
    onGoalsChange?.(sortedGoals.map((goal) => (goal.id === updated.id ? updated : goal)));
  };

  if (sortedGoals.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <Target className="mx-auto h-8 w-8 text-muted-foreground/70" />
        <p className="mt-3 text-sm font-medium">No goals logged yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwnProfile
            ? 'Open a hope post and click "Log as Goal" to start your branching timeline.'
            : "This member has not converted any hopes into goals yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Goal tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vertical timeline with horizontal step branches — upload proof to unlock each arrow.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          {sortedGoals.filter((g) => g.status === "in_progress").length} active
        </Badge>
      </div>

      <div className="relative mx-auto max-w-5xl">
        {/* Vertical spine — strictly behind carousel rows */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 z-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-emerald-500/60 via-border to-border sm:block"
        />

        <div className="relative z-10 space-y-12 sm:space-y-16">
          {sortedGoals.map((goal, index) => {
            const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
            const verifiedCount = countVerifiedSteps(goal);
            const totalSteps = goal.milestones.length;
            const goalActive = isGoalTrackerActive(goal);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4 }}
                className={cn(
                  "relative z-10 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]",
                  side === "left" ? "sm:[&>*:first-child]:order-1" : "",
                )}
              >
                {/* Left column */}
                <div
                  className={cn(
                    "relative z-10 min-w-0 max-w-full overflow-hidden",
                    side === "left" ? "sm:pr-4 sm:text-right" : "hidden sm:block sm:pr-4",
                  )}
                >
                  {side === "left" && (
                    <StepBoxChain
                      goal={goal}
                      side="left"
                      isOwnProfile={isOwnProfile}
                      onGoalUpdate={handleGoalUpdate}
                      onOpenGoalDetails={() => setSelectedGoal(goal)}
                    />
                  )}
                </div>

                {/* Center node + ambient intersection glow */}
                <div className="relative z-20 mx-auto flex flex-col items-center">
                  {/* Radial glow behind node */}
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-5 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl",
                      goalActive
                        ? "bg-gradient-to-br from-fuchsia-500/30 via-cyan-400/25 to-emerald-500/20"
                        : "bg-emerald-500/25",
                    )}
                  />
                  {/* Horizontal bleed into branch track */}
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-5 h-20 w-40 -translate-y-1/2 rounded-full blur-xl",
                      side === "left"
                        ? goalActive
                          ? "right-1/2 mr-3 bg-gradient-to-l from-fuchsia-500/25 via-cyan-400/20 to-transparent"
                          : "right-1/2 mr-3 bg-gradient-to-l from-cyan-500/20 via-emerald-500/15 to-transparent"
                        : goalActive
                          ? "left-1/2 ml-3 bg-gradient-to-r from-fuchsia-500/25 via-cyan-400/20 to-transparent"
                          : "left-1/2 ml-3 bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-transparent",
                    )}
                  />
                  <SiriWaveIconCircle active={goalActive} size={44} className="relative z-10" />
                  <p className="relative z-10 mt-2 max-w-[120px] text-center text-[11px] text-muted-foreground">
                    {formatGoalDate(goal.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedGoal(goal)}
                    className="relative z-10 mt-0.5 max-w-[140px] cursor-pointer rounded-md px-1 py-0.5 text-center transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
                    title={goal.title}
                  >
                    <p className="line-clamp-2 text-xs font-medium leading-tight">{goal.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {verifiedCount}/{totalSteps} steps · View details
                    </p>
                  </button>
                </div>

                {/* Right column */}
                <div
                  className={cn(
                    "relative z-10 min-w-0 max-w-full overflow-hidden",
                    side === "right" ? "sm:pl-4" : "sm:hidden",
                  )}
                >
                  {side === "right" ? (
                    <StepBoxChain
                      goal={goal}
                      side="right"
                      isOwnProfile={isOwnProfile}
                      onGoalUpdate={handleGoalUpdate}
                      onOpenGoalDetails={() => setSelectedGoal(goal)}
                    />
                  ) : (
                    /* Mobile: always show chain below node */
                    <div className="sm:hidden">
                      <StepBoxChain
                        goal={goal}
                        side="right"
                        isOwnProfile={isOwnProfile}
                        onGoalUpdate={handleGoalUpdate}
                        onOpenGoalDetails={() => setSelectedGoal(goal)}
                      />
                    </div>
                  )}
                </div>

                {/* Mobile fallback for left-side goals */}
                {side === "left" && (
                  <div className="col-span-full relative z-10 max-w-full overflow-hidden sm:hidden">
                    <StepBoxChain
                      goal={goal}
                      side="right"
                      isOwnProfile={isOwnProfile}
                      onGoalUpdate={handleGoalUpdate}
                      onOpenGoalDetails={() => setSelectedGoal(goal)}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <GoalDetailModal
        goal={selectedGoal}
        catalog={catalog}
        open={Boolean(selectedGoal)}
        onOpenChange={(open) => {
          if (!open) setSelectedGoal(null);
        }}
      />
    </div>
  );
}
