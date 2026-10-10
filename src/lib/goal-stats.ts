import type { Goal, GoalMilestone, GoalWithDetails } from "@/types/hope-goal";

export function isGoalCompleted(
  goal: Pick<Goal, "id" | "status">,
  milestones: GoalMilestone[],
): boolean {
  if (goal.status === "completed") return true;
  const steps = milestones.filter((m) => m.goal_id === goal.id);
  return steps.length > 0 && steps.every((m) => m.is_completed);
}

export function isGoalWithDetailsCompleted(goal: GoalWithDetails): boolean {
  return (
    goal.status === "completed" ||
    (goal.milestones.length > 0 && goal.milestones.every((m) => m.is_completed))
  );
}

export function countCompletedGoals(goals: Goal[], milestones: GoalMilestone[]): number {
  return goals.filter((goal) => isGoalCompleted(goal, milestones)).length;
}

export function formatGoalsCompletedLabel(count: number): string {
  return `${count} ${count === 1 ? "goal" : "goals"} completed`;
}

export function formatHopesLoggedLabel(count: number): string {
  return `${count} ${count === 1 ? "hope" : "hopes"} logged`;
}

export function formatCompactAchievedLabel(count: number): string {
  return `${count} achieved`;
}
