import type { Goal } from "@/types/hope-goal";

const LEGACY_GOALS_KEY = "pivoton-hope-goals";
const USER_GOALS_PREFIX = "pivoton-user-goals:";
const GOALS_CHANGED_EVENT = "pivoton-user-goals-changed";

function notifyGoalsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOALS_CHANGED_EVENT));
}

export function subscribeUserGoalsStorage(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(GOALS_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(GOALS_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function userGoalsKey(userId: string): string {
  return `${USER_GOALS_PREFIX}${userId}`;
}

function readLegacyGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_GOALS_KEY);
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

function writeLegacyGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_GOALS_KEY, JSON.stringify(goals));
  } catch {
    // Best-effort cache.
  }
}

function readUserScopedGoalsRaw(userId: string): Goal[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(userGoalsKey(userId));
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

function writeUserScopedGoals(userId: string, goals: Goal[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(userGoalsKey(userId), JSON.stringify(goals));
  } catch {
    // Best-effort cache.
  }
}

function preferGoalRecord(local: Goal, remote: Goal): Goal {
  const localSynthetic =
    local.id.startsWith("optimistic-") || local.id.startsWith("goal-");
  const remoteSynthetic =
    remote.id.startsWith("optimistic-") || remote.id.startsWith("goal-");
  if (localSynthetic && !remoteSynthetic) return remote;
  if (!localSynthetic && remoteSynthetic) return local;
  if (remote.status === "completed" && local.status !== "completed") return remote;
  if (local.status === "completed" && remote.status !== "completed") return local;
  return new Date(remote.created_at).getTime() >= new Date(local.created_at).getTime()
    ? remote
    : local;
}

/** Read goals for one user from scoped storage with legacy fallback. */
export function readGoalsForUser(userId: string): Goal[] {
  if (!userId) return [];
  const scoped = readUserScopedGoalsRaw(userId);
  const legacy = readLegacyGoals().filter((goal) => goal.user_id === userId);

  const merged = new Map<string, Goal>();
  for (const goal of legacy) merged.set(goal.post_id, goal);
  for (const goal of scoped) {
    const existing = merged.get(goal.post_id);
    merged.set(goal.post_id, existing ? preferGoalRecord(existing, goal) : goal);
  }
  return Array.from(merged.values());
}

export function readGoalForUserPost(userId: string, postId: string): Goal | null {
  return readGoalsForUser(userId).find((goal) => goal.post_id === postId) ?? null;
}

export function readGoalsForPostIds(postIds: string[]): Goal[] {
  if (postIds.length === 0) return [];
  const idSet = new Set(postIds);
  const merged = new Map<string, Goal>();

  for (const goal of readLegacyGoals()) {
    if (idSet.has(goal.post_id)) merged.set(`${goal.user_id}:${goal.post_id}`, goal);
  }

  if (typeof window !== "undefined") {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(USER_GOALS_PREFIX)) continue;
      try {
        const goals = JSON.parse(localStorage.getItem(key) ?? "[]") as Goal[];
        for (const goal of goals) {
          if (idSet.has(goal.post_id)) {
            merged.set(`${goal.user_id}:${goal.post_id}`, goal);
          }
        }
      } catch {
        // Skip corrupt entries.
      }
    }
  }

  return Array.from(merged.values());
}

export function upsertGoalForUser(goal: Goal) {
  if (!goal.user_id) return;

  const userGoals = readGoalsForUser(goal.user_id);
  const index = userGoals.findIndex(
    (item) => item.post_id === goal.post_id || item.id === goal.id,
  );
  if (index >= 0) userGoals[index] = preferGoalRecord(userGoals[index]!, goal);
  else userGoals.unshift(goal);
  writeUserScopedGoals(goal.user_id, userGoals);

  const legacy = readLegacyGoals();
  const legacyIndex = legacy.findIndex(
    (item) => item.post_id === goal.post_id || item.id === goal.id,
  );
  if (legacyIndex >= 0) legacy[legacyIndex] = preferGoalRecord(legacy[legacyIndex]!, goal);
  else legacy.unshift(goal);
  writeLegacyGoals(legacy);
  notifyGoalsChanged();
}

export function replaceGoalsForUser(userId: string, goals: Goal[]) {
  if (!userId) return;
  writeUserScopedGoals(userId, goals);

  const legacy = readLegacyGoals().filter((goal) => goal.user_id !== userId);
  writeLegacyGoals([...goals, ...legacy]);
  notifyGoalsChanged();
}
