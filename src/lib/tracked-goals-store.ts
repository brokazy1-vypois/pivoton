import { useSyncExternalStore } from "react";
import { readGoalForUserPost, readGoalsForUser, subscribeUserGoalsStorage } from "@/lib/user-goals-storage";

const STORAGE_KEY = "pivoton-tracked-goal-posts";

type TrackedMap = Record<string, string[]>;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function readTrackedMap(): TrackedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackedMap) : {};
  } catch {
    return {};
  }
}

function writeTrackedMap(map: TrackedMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    emitChange();
  } catch {
    // Best-effort persistence only.
  }
}

export function markPostAsTracked(userId: string, postId: string) {
  if (!userId || !postId) return;
  const map = readTrackedMap();
  const next = new Set(map[userId] ?? []);
  next.add(postId);
  map[userId] = [...next];
  writeTrackedMap(map);
}

export function syncTrackedPostsForUser(userId: string, postIds: string[]) {
  if (!userId || postIds.length === 0) return;
  const map = readTrackedMap();
  const next = new Set(map[userId] ?? []);
  let changed = false;
  for (const postId of postIds) {
    if (!next.has(postId)) {
      next.add(postId);
      changed = true;
    }
  }
  if (!changed) return;
  map[userId] = [...next];
  writeTrackedMap(map);
}

export function isPostTracked(userId: string, postId: string): boolean {
  if (!userId || !postId) return false;
  if ((readTrackedMap()[userId] ?? []).includes(postId)) return true;
  return readGoalForUserPost(userId, postId) !== null;
}

export function readTrackedPostIdsForUser(userId: string): string[] {
  if (!userId) return [];
  const fromIndex = new Set(readTrackedMap()[userId] ?? []);
  for (const goal of readGoalsForUser(userId)) {
    fromIndex.add(goal.post_id);
  }
  return [...fromIndex];
}

/** Merge tracked post ids from durable goal caches into the lightweight index. */
export function bootstrapTrackedGoalsIndex() {
  if (typeof window === "undefined") return;

  const map = readTrackedMap();
  let changed = false;

  const userIds = new Set<string>(Object.keys(map));
  if (typeof window !== "undefined") {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("pivoton-user-goals:")) {
        userIds.add(key.slice("pivoton-user-goals:".length));
      }
    }
  }

  for (const userId of userIds) {
    for (const goal of readGoalsForUser(userId)) {
      const existing = new Set(map[userId] ?? []);
      if (!existing.has(goal.post_id)) {
        existing.add(goal.post_id);
        map[userId] = [...existing];
        changed = true;
      }
    }
  }

  if (changed) writeTrackedMap(map);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY ||
      event.key?.startsWith("pivoton-user-goals:") ||
      event.key === "pivoton-hope-goals"
    ) {
      listener();
    }
  };

  window.addEventListener("storage", onStorage);
  const unsubscribeGoals = subscribeUserGoalsStorage(listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    unsubscribeGoals();
  };
}

export function useIsPostTracked(
  userId: string | null | undefined,
  postId: string,
): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? isPostTracked(userId, postId) : false),
    () => false,
  );
}

if (typeof window !== "undefined") {
  bootstrapTrackedGoalsIndex();
}
