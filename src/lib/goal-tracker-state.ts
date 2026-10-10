import type { GoalWithDetails } from "@/types/hope-goal";
import { isGoalWithDetailsCompleted } from "@/lib/goal-stats";

function isStepVerified(milestone: GoalWithDetails["milestones"][number]): boolean {
  return milestone.is_completed || milestone.verification_status === "verified";
}

/** Milestones with AI-verified proof (or manually marked complete). */
export function countVerifiedSteps(goal: Pick<GoalWithDetails, "milestones">): number {
  return goal.milestones.filter(isStepVerified).length;
}

/** True when every step is verified — triggers Siri sphere + Granim card. */
export function isGoalStepsVerified(goal: Pick<GoalWithDetails, "milestones">): boolean {
  const totalSteps = goal.milestones.length;
  if (totalSteps === 0) return false;
  return goal.milestones.every(isStepVerified);
}

/** Drives active timeline visuals once the final goal path is fully verified. */
export function isGoalTrackerActive(goal: GoalWithDetails): boolean {
  return isGoalWithDetailsCompleted(goal) || isGoalStepsVerified(goal);
}
