import { convertHopePostToGoalServer } from "@/lib/hope-goal-planner.server";
import { negotiateGoalStepServer } from "@/lib/hope-goal-negotiate.server";
import { verifyGoalStepProofServer } from "@/lib/hope-goal-verify.server";
import { countCompletedGoals } from "@/lib/goal-stats";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  readGoalForUserPost,
  readGoalsForPostIds,
  readGoalsForUser,
  replaceGoalsForUser,
  upsertGoalForUser,
} from "@/lib/user-goals-storage";
import { fileToDataUrl, uploadHopePostAttachment } from "@/services/hope-post-attachments";
import type {
  AiGuidanceNote,
  ConvertHopePostToGoalInput,
  Goal,
  GoalMilestone,
  GoalStatus,
  GoalWithDetails,
  NegotiateStepResult,
  StepChatMessage,
  StepVerificationStatus,
  VerifyStepProofResult,
} from "@/types/hope-goal";
import type { HopePost } from "@/types/hope-post";

const LOCAL_GOALS_KEY = "pivoton-hope-goals";
const LOCAL_MILESTONES_KEY = "pivoton-goal-milestones";
const LOCAL_GUIDANCE_KEY = "pivoton-ai-guidance-notes";
const LOCAL_STEP_CHATS_KEY = "pivoton-goal-step-chats";

function createLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocalGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_GOALS_KEY);
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

/** Read every cached goal row — used to rebuild the tracked-post index on load. */
export function readAllLocalGoals(): Goal[] {
  return readLocalGoals();
}

function writeLocalGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goals));
  } catch {
    // Best-effort local cache only.
  }
}

/** Upsert goals without dropping records for other users or untracked posts. */
function mergePersistLocalGoals(updates: Goal[]) {
  if (updates.length === 0) return;
  let goals = readLocalGoals();
  for (const goal of updates) {
    const index = goals.findIndex(
      (item) => item.post_id === goal.post_id || item.id === goal.id,
    );
    if (index >= 0) goals[index] = preferGoalRecord(goals[index]!, goal);
    else goals.unshift(goal);
  }
  writeLocalGoals(goals);
}

function readLocalMilestones(): GoalMilestone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_MILESTONES_KEY);
    return raw ? (JSON.parse(raw) as GoalMilestone[]) : [];
  } catch {
    return [];
  }
}

function writeLocalMilestones(milestones: GoalMilestone[]) {
  if (typeof window === "undefined") return;
  try {
    for (const milestone of milestones) {
      if (milestone.proof_url) writeProofUrlToCache(milestone.id, milestone.proof_url);
    }
    localStorage.setItem(
      LOCAL_MILESTONES_KEY,
      JSON.stringify(milestones.map(slimMilestoneForLocalStorage)),
    );
  } catch {
    // Best-effort local cache only.
  }
}

const LOCAL_PROOF_URLS_KEY = "pivoton-goal-proof-urls";

function readProofUrlCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_PROOF_URLS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeProofUrlCache(cache: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(cache).length === 0) {
      localStorage.removeItem(LOCAL_PROOF_URLS_KEY);
      return;
    }
    localStorage.setItem(LOCAL_PROOF_URLS_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort inline proof cache.
  }
}

function writeProofUrlToCache(milestoneId: string, url: string) {
  if (!shouldOmitAttachmentFromLocalCache(url)) {
    const cache = readProofUrlCache();
    if (cache[milestoneId]) {
      delete cache[milestoneId];
      writeProofUrlCache(cache);
    }
    return;
  }
  writeProofUrlCache({ ...readProofUrlCache(), [milestoneId]: url });
}

/** Restore proof URLs stripped from milestone JSON or missing after remote fetch. */
export function hydrateMilestoneProofs(milestones: GoalMilestone[]): GoalMilestone[] {
  const cache = readProofUrlCache();
  return milestones.map((milestone) => ({
    ...milestone,
    proof_url: milestone.proof_url ?? cache[milestone.id] ?? null,
  }));
}

function milestoneProgressScore(milestone: GoalMilestone): number {
  let score = 0;
  if (milestone.proof_url) score += 2;
  if (milestone.is_completed) score += 4;
  if (milestone.verification_status === "verified") score += 8;
  if (milestone.verification_status === "rejected") score += 1;
  return score;
}

function mergeMilestoneRecord(a: GoalMilestone, b: GoalMilestone): GoalMilestone {
  const primary = milestoneProgressScore(a) >= milestoneProgressScore(b) ? a : b;
  const secondary = primary === a ? b : a;
  const verification_status: StepVerificationStatus =
    primary.verification_status === "verified" || secondary.verification_status === "verified"
      ? "verified"
      : primary.verification_status === "rejected" || secondary.verification_status === "rejected"
        ? "rejected"
        : (primary.verification_status ?? secondary.verification_status ?? "pending");

  return {
    ...primary,
    proof_url: primary.proof_url ?? secondary.proof_url ?? null,
    verification_status,
    is_completed: primary.is_completed || secondary.is_completed,
    completed_at: primary.completed_at ?? secondary.completed_at,
    criteria: primary.criteria ?? secondary.criteria ?? primary.title,
    title: primary.title || secondary.title,
  };
}

function mergeMilestoneLists(remote: GoalMilestone[], local: GoalMilestone[]): GoalMilestone[] {
  const merged = new Map<string, GoalMilestone>();
  for (const milestone of remote) merged.set(milestone.id, milestone);
  for (const milestone of local) {
    const existing = merged.get(milestone.id);
    merged.set(milestone.id, existing ? mergeMilestoneRecord(existing, milestone) : milestone);
  }
  return Array.from(merged.values());
}

function upsertLocalMilestone(milestone: GoalMilestone) {
  const milestones = readLocalMilestones();
  const index = milestones.findIndex((item) => item.id === milestone.id);
  if (index >= 0) milestones[index] = mergeMilestoneRecord(milestones[index]!, milestone);
  else milestones.push(milestone);
  writeLocalMilestones(milestones);
}

async function loadMilestoneById(milestoneId: string): Promise<GoalMilestone | null> {
  const cached = hydrateMilestoneProofs(readLocalMilestones()).find(
    (item) => item.id === milestoneId,
  );
  if (cached) return cached;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("goal_milestones")
    .select(MILESTONE_FULL_SELECT)
    .eq("id", milestoneId)
    .maybeSingle();

  if (error || !data) {
    if (error && !isSchemaMismatchError(error.message)) {
      throw new Error(error.message);
    }
    return null;
  }

  return hydrateMilestoneProofs([mapMilestoneRow(data as Record<string, unknown>)])[0] ?? null;
}

/** Keep local milestone cache aligned with in-session goal tracker updates. */
export function syncGoalToLocalCache(goal: GoalWithDetails): void {
  for (const milestone of goal.milestones) {
    upsertLocalMilestone(milestone);
  }
  writeLocalGoals(
    readLocalGoals().map((item) => (item.id === goal.id ? { ...item, status: goal.status } : item)),
  );
}

function shouldOmitAttachmentFromLocalCache(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("data:") || url.startsWith("blob:") || url.length > 512;
}

function readLocalGuidance(): AiGuidanceNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_GUIDANCE_KEY);
    return raw ? (JSON.parse(raw) as AiGuidanceNote[]) : [];
  } catch {
    return [];
  }
}

function writeLocalGuidance(notes: AiGuidanceNote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_GUIDANCE_KEY, JSON.stringify(notes));
  } catch {
    // Best-effort local cache only.
  }
}

const MAX_LOCAL_STEP_CHATS = 80;

export function isBrowserStorageQuotaError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "QuotaExceededError") return true;
  const message = readErrorMessage(error).toLowerCase();
  return message.includes("quota has been exceeded") || message.includes("quotaexceedederror");
}

export function isStepChatRateLimitError(error: unknown): boolean {
  const message = readErrorMessage(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("resource has been exhausted") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

export function getStepChatUserFacingError(error: unknown): {
  tone: "warning" | "error";
  message: string;
} {
  if (isStepChatRateLimitError(error)) {
    return {
      tone: "warning",
      message: "Rate limit reached. Please wait a moment before sending another request.",
    };
  }
  if (isBrowserStorageQuotaError(error)) {
    return {
      tone: "warning",
      message:
        "Browser storage is full. Your message was kept in this session — clear site data if this persists.",
    };
  }
  return {
    tone: "error",
    message: readErrorMessage(error) || "Could not send message.",
  };
}

function slimMilestoneForLocalStorage(milestone: GoalMilestone): GoalMilestone {
  if (shouldOmitAttachmentFromLocalCache(milestone.proof_url)) {
    return { ...milestone, proof_url: null };
  }
  return milestone;
}

function slimChatForLocalStorage(message: StepChatMessage): StepChatMessage {
  if (!shouldOmitAttachmentFromLocalCache(message.attachment_url)) return message;
  return {
    ...message,
    attachment_url: null,
  };
}

/** Restore proof thumbnails when local cache stripped inline data URLs. */
export function hydrateStepChatAttachments(
  messages: StepChatMessage[],
  proofUrl?: string | null,
): StepChatMessage[] {
  if (!proofUrl) return messages;
  return messages.map((message) => {
    if (
      message.role === "system" &&
      message.content.toLowerCase().includes("uploaded proof") &&
      !message.attachment_url
    ) {
      return {
        ...message,
        attachment_url: proofUrl,
        attachment_type: message.attachment_type ?? "image",
      };
    }
    return message;
  });
}

function isSchemaMismatchError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("could not find") ||
    lower.includes("schema cache") ||
    lower.includes("goal_milestones") ||
    lower.includes("goal_steps") ||
    lower.includes("step_chats") ||
    lower.includes("column")
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

const MILESTONE_FULL_SELECT =
  "id, goal_id, title, criteria, is_completed, completed_at, order_index, proof_url, verification_status";
const MILESTONE_BASE_SELECT = "id, goal_id, title, is_completed, completed_at, order_index";

async function fetchMilestonesForGoals(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  goalIds: string[],
): Promise<GoalMilestone[]> {
  const full = await supabase
    .from("goal_milestones")
    .select(MILESTONE_FULL_SELECT)
    .in("goal_id", goalIds)
    .order("order_index", { ascending: true });

  if (!full.error && full.data) {
    return full.data.map((row) => mapMilestoneRow(row as Record<string, unknown>));
  }

  if (full.error && isSchemaMismatchError(full.error.message)) {
    const fallback = await supabase
      .from("goal_milestones")
      .select(MILESTONE_BASE_SELECT)
      .in("goal_id", goalIds)
      .order("order_index", { ascending: true });

    if (!fallback.error && fallback.data) {
      return fallback.data.map((row) => mapMilestoneRow(row as Record<string, unknown>));
    }
  }

  return [];
}

async function insertGoalMilestones(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  savedGoalId: string,
  milestones: GoalMilestone[],
): Promise<GoalMilestone[]> {
  const fullRows = milestones.map((item, index) => ({
    goal_id: savedGoalId,
    title: item.title,
    criteria: item.criteria ?? item.title,
    is_completed: false,
    order_index: index,
    verification_status: "pending",
  }));

  let result = await supabase
    .from("goal_milestones")
    .insert(fullRows)
    .select(MILESTONE_FULL_SELECT);

  if (result.error && isSchemaMismatchError(result.error.message)) {
    const minimalRows = milestones.map((item, index) => ({
      goal_id: savedGoalId,
      title: item.title,
      is_completed: false,
      order_index: index,
    }));
    result = await supabase
      .from("goal_milestones")
      .insert(minimalRows)
      .select(MILESTONE_BASE_SELECT);
  }

  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map((row) => mapMilestoneRow(row as Record<string, unknown>));
}

function mapGoalRow(row: Record<string, unknown>): Goal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    post_id: String(row.post_id),
    title: String(row.title),
    status: String(row.status) as GoalStatus,
    created_at: String(row.created_at),
  };
}

function mapMilestoneRow(row: Record<string, unknown>): GoalMilestone {
  return {
    id: String(row.id),
    goal_id: String(row.goal_id),
    title: String(row.title),
    criteria: row.criteria ? String(row.criteria) : String(row.title),
    is_completed: Boolean(row.is_completed),
    completed_at: row.completed_at ? String(row.completed_at) : null,
    order_index: Number(row.order_index ?? 0),
    proof_url: row.proof_url ? String(row.proof_url) : null,
    verification_status: (row.verification_status as StepVerificationStatus) ?? "pending",
  };
}

function mapGuidanceRow(row: Record<string, unknown>): AiGuidanceNote {
  return {
    id: String(row.id),
    goal_id: String(row.goal_id),
    instruction_text: String(row.instruction_text),
    suggested_next_step: String(row.suggested_next_step),
    created_at: String(row.created_at),
  };
}

/** Merge remote + local goals without dropping tracked posts on empty remote responses. */
export function mergeGoalLists(remote: Goal[], local: Goal[]): Goal[] {
  const merged = new Map<string, Goal>();
  for (const goal of local) merged.set(goal.post_id, goal);
  for (const goal of remote) {
    const existing = merged.get(goal.post_id);
    merged.set(goal.post_id, existing ? preferGoalRecord(existing, goal) : goal);
  }
  return Array.from(merged.values());
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

export function upsertLocalGoal(goal: Goal) {
  upsertGoalForUser(goal);
}

export function readLocalGoalsForUser(userId: string): Goal[] {
  return readGoalsForUser(userId);
}

export function readLocalGoalsForPostIds(postIds: string[]): Goal[] {
  return readGoalsForPostIds(postIds);
}

export function readLocalGoalForUserPost(userId: string, postId: string): Goal | null {
  return readGoalForUserPost(userId, postId);
}

export function readLocalUserGoalsWithDetails(
  userId: string,
  posts: HopePost[],
): GoalWithDetails[] {
  const goals = readLocalGoalsForUser(userId);
  const milestones = hydrateMilestoneProofs(readLocalMilestones());
  const guidance = readLocalGuidance();
  return goals
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((goal) => assembleGoalDetails(goal, milestones, guidance, posts));
}

function assembleGoalDetails(
  goal: Goal,
  milestones: GoalMilestone[],
  guidanceNotes: AiGuidanceNote[],
  posts: HopePost[],
): GoalWithDetails {
  const goalMilestones = milestones
    .filter((item) => item.goal_id === goal.id)
    .sort((a, b) => a.order_index - b.order_index);
  const guidance =
    guidanceNotes
      .filter((item) => item.goal_id === goal.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ??
    null;

  return {
    ...goal,
    milestones: goalMilestones,
    guidance,
    post: posts.find((post) => post.id === goal.post_id) ?? null,
  };
}

async function fetchSupabaseGoalsForUser(userId: string): Promise<{
  goals: Goal[];
  milestones: GoalMilestone[];
  guidance: AiGuidanceNote[];
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: goalsData, error: goalsError } = await supabase
    .from("goals")
    .select("id, user_id, post_id, title, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (goalsError || !goalsData?.length) {
    return goalsError ? null : { goals: [], milestones: [], guidance: [] };
  }

  const goals = goalsData.map((row) => mapGoalRow(row as Record<string, unknown>));
  const goalIds = goals.map((goal) => goal.id);

  const [milestones, guidanceResult] = await Promise.all([
    fetchMilestonesForGoals(supabase, goalIds),
    supabase
      .from("ai_guidance_notes")
      .select("id, goal_id, instruction_text, suggested_next_step, created_at")
      .in("goal_id", goalIds)
      .order("created_at", { ascending: false }),
  ]);

  return {
    goals,
    milestones,
    guidance: (guidanceResult.data ?? []).map((row) =>
      mapGuidanceRow(row as Record<string, unknown>),
    ),
  };
}

export async function fetchGoalsByPostIds(postIds: string[]): Promise<Goal[]> {
  if (postIds.length === 0) return [];

  const local = readGoalsForPostIds(postIds);
  const supabase = getSupabase();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("goals")
    .select("id, user_id, post_id, title, status, created_at")
    .in("post_id", postIds);

  if (error) {
    return mergeGoalLists([], local);
  }

  if (!data?.length) {
    return local;
  }

  const remote = data.map((row) => mapGoalRow(row as Record<string, unknown>));
  return mergeGoalLists(remote, local);
}

export async function fetchUserGoalsWithDetails(
  userId: string,
  posts: HopePost[],
): Promise<GoalWithDetails[]> {
  const remote = await fetchSupabaseGoalsForUser(userId);

  let goals: Goal[];
  let milestones: GoalMilestone[];
  let guidance: AiGuidanceNote[];

  if (remote) {
    const localGoals = readGoalsForUser(userId);
    goals = mergeGoalLists(remote.goals, localGoals);
    const localMilestones = hydrateMilestoneProofs(readLocalMilestones());
    milestones = hydrateMilestoneProofs(mergeMilestoneLists(remote.milestones, localMilestones));
    guidance = remote.guidance;

    goals = goals.map((goal) => {
      const cached = localGoals.find((item) => item.id === goal.id || item.post_id === goal.post_id);
      if (cached?.status === "completed" && goal.status === "in_progress") {
        return { ...goal, status: "completed" as const };
      }
      return goal;
    });

    replaceGoalsForUser(userId, goals);
    writeLocalMilestones(milestones);
    writeLocalGuidance(guidance);
  } else {
    goals = readGoalsForUser(userId);
    milestones = hydrateMilestoneProofs(readLocalMilestones());
    guidance = readLocalGuidance();
  }

  return goals
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((goal) => assembleGoalDetails(goal, milestones, guidance, posts));
}

export interface UserGoalStats {
  completed: number;
  total: number;
}

export async function fetchUserGoalStats(userId: string): Promise<UserGoalStats> {
  const remote = await fetchSupabaseGoalsForUser(userId);

  let goals: Goal[];
  let milestones: GoalMilestone[];

  if (remote) {
    const localGoals = readGoalsForUser(userId);
    goals = mergeGoalLists(remote.goals, localGoals);
    const localMilestones = hydrateMilestoneProofs(readLocalMilestones());
    milestones = hydrateMilestoneProofs(mergeMilestoneLists(remote.milestones, localMilestones));
  } else {
    goals = readGoalsForUser(userId);
    milestones = hydrateMilestoneProofs(readLocalMilestones());
  }

  return {
    completed: countCompletedGoals(goals, milestones),
    total: goals.length,
  };
}

export async function fetchGoalStatsForUsers(
  userIds: string[],
): Promise<Record<string, UserGoalStats>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const supabase = getSupabase();
  if (!supabase) {
    const entries = await Promise.all(
      unique.map(async (userId) => [userId, await fetchUserGoalStats(userId)] as const),
    );
    return Object.fromEntries(entries);
  }

  const { data: goalsData, error: goalsError } = await supabase
    .from("goals")
    .select("user_id, status")
    .in("user_id", unique);

  if (goalsError || !goalsData) {
    const entries = await Promise.all(
      unique.map(async (userId) => [userId, await fetchUserGoalStats(userId)] as const),
    );
    return Object.fromEntries(entries);
  }

  const stats: Record<string, UserGoalStats> = Object.fromEntries(
    unique.map((userId) => [userId, { completed: 0, total: 0 }]),
  );

  for (const row of goalsData) {
    const userId = String(row.user_id);
    if (!stats[userId]) stats[userId] = { completed: 0, total: 0 };
    stats[userId].total += 1;
    if (row.status === "completed") stats[userId].completed += 1;
  }

  return stats;
}

/** Push locally cached goals to Supabase when the user signs back in. */
export async function syncLocalGoalsToSupabase(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session || auth.session.user.id !== userId) return;

  const localGoals = readGoalsForUser(userId);
  if (localGoals.length === 0) return;

  const remote = await fetchSupabaseGoalsForUser(userId);
  const remotePostIds = new Set((remote?.goals ?? []).map((goal) => goal.post_id));

  for (const goal of localGoals) {
    if (remotePostIds.has(goal.post_id)) continue;

    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        post_id: goal.post_id,
        title: goal.title,
        status: goal.status,
      })
      .select("id, user_id, post_id, title, status, created_at")
      .maybeSingle();

    if (error) {
      const duplicate =
        error.message.includes("duplicate") || error.message.includes("unique");
      if (duplicate) {
        const { data: existing } = await supabase
          .from("goals")
          .select("id, user_id, post_id, title, status, created_at")
          .eq("user_id", userId)
          .eq("post_id", goal.post_id)
          .maybeSingle();
        if (existing) {
          upsertGoalForUser(mapGoalRow(existing as Record<string, unknown>));
        }
      }
      continue;
    }

    if (data) {
      upsertGoalForUser(mapGoalRow(data as Record<string, unknown>));
    }
  }
}

export async function convertHopePostToGoal(
  input: ConvertHopePostToGoalInput,
): Promise<GoalWithDetails> {
  const existing = (await fetchGoalsByPostIds([input.post.id])).find(
    (goal) => goal.user_id === input.userId,
  );
  if (existing) {
    const all = await fetchUserGoalsWithDetails(input.userId, [input.post]);
    const found = all.find((goal) => goal.id === existing.id);
    if (found) return found;
  }

  const aiResult = await convertHopePostToGoalServer({
    data: {
      post: input.post,
      attachedProductNames: input.attachedProductNames ?? [],
    },
  }).catch((error) => {
    throw new Error(readErrorMessage(error) || "Could not generate goal steps.");
  });

  const now = new Date().toISOString();
  const goalId = createLocalId("goal");
  const goal: Goal = {
    id: goalId,
    user_id: input.userId,
    post_id: input.post.id,
    title: aiResult.big_goal_title,
    status: "in_progress",
    created_at: now,
  };

  const milestones: GoalMilestone[] = aiResult.milestones.map((title, index) => ({
    id: createLocalId("milestone"),
    goal_id: goalId,
    title,
    criteria: title,
    is_completed: false,
    completed_at: null,
    order_index: index,
    proof_url: null,
    verification_status: "pending" as const,
  }));

  const guidance: AiGuidanceNote = {
    id: createLocalId("guidance"),
    goal_id: goalId,
    instruction_text: aiResult.next_action_instruction,
    suggested_next_step: milestones[0]?.title ?? aiResult.next_action_instruction,
    created_at: now,
  };

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured) {
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session || auth.session.user.id !== input.userId) {
        throw new Error("schema_mismatch");
      }

      const { data: insertedGoal, error: goalError } = await supabase
        .from("goals")
        .insert({
          user_id: input.userId,
          post_id: input.post.id,
          title: goal.title,
          status: goal.status,
        })
        .select("id, user_id, post_id, title, status, created_at")
        .single();

      if (goalError) {
        if (!goalError.message.includes("duplicate") && !goalError.message.includes("unique")) {
          if (isSchemaMismatchError(goalError.message)) {
            throw new Error(goalError.message);
          }
          throw new Error(goalError.message);
        }
        const { data: existingGoal } = await supabase
          .from("goals")
          .select("id, user_id, post_id, title, status, created_at")
          .eq("user_id", input.userId)
          .eq("post_id", input.post.id)
          .maybeSingle();
        if (existingGoal) {
          const details = await fetchUserGoalsWithDetails(input.userId, [input.post]);
          const match = details.find((item) => item.id === String(existingGoal.id));
          if (match) return match;
        }
        throw new Error(goalError.message);
      }

      const savedGoal = mapGoalRow(insertedGoal as Record<string, unknown>);
      const savedMilestones = await insertGoalMilestones(supabase, savedGoal.id, milestones);

      const { data: insertedGuidance, error: guidanceError } = await supabase
        .from("ai_guidance_notes")
        .insert({
          goal_id: savedGoal.id,
          instruction_text: guidance.instruction_text,
          suggested_next_step: guidance.suggested_next_step,
        })
        .select("id, goal_id, instruction_text, suggested_next_step, created_at")
        .single();

      if (guidanceError) throw new Error(guidanceError.message);

      await supabase
        .from("hope_posts")
        .update({ hope_status: "in_progress" })
        .eq("id", input.post.id);

      const savedGuidance = mapGuidanceRow(insertedGuidance as Record<string, unknown>);

      upsertGoalForUser(savedGoal);
      writeLocalMilestones([
        ...savedMilestones,
        ...readLocalMilestones().filter((item) => item.goal_id !== savedGoal.id),
      ]);
      writeLocalGuidance([
        savedGuidance,
        ...readLocalGuidance().filter((item) => item.goal_id !== savedGoal.id),
      ]);

      return assembleGoalDetails(savedGoal, savedMilestones, [savedGuidance], [input.post]);
    } catch (error) {
      const message = readErrorMessage(error);
      if (!isSchemaMismatchError(message)) {
        throw new Error(message);
      }
      // Fall through to local persistence when goals tables are not migrated yet.
    }
  }

  upsertGoalForUser(goal);
  writeLocalMilestones([...milestones, ...readLocalMilestones()]);
  writeLocalGuidance([guidance, ...readLocalGuidance()]);

  return assembleGoalDetails(goal, milestones, [guidance], [input.post]);
}

export async function toggleGoalMilestone(
  milestoneId: string,
  completed: boolean,
): Promise<GoalMilestone | null> {
  const completedAt = completed ? new Date().toISOString() : null;
  const localMilestones = readLocalMilestones();
  const target = localMilestones.find((item) => item.id === milestoneId);
  if (!target) return null;

  const updated: GoalMilestone = {
    ...target,
    is_completed: completed,
    completed_at: completedAt,
  };

  writeLocalMilestones(localMilestones.map((item) => (item.id === milestoneId ? updated : item)));

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("goal_milestones")
      .update({ is_completed: completed, completed_at: completedAt })
      .eq("id", milestoneId)
      .select(
        "id, goal_id, title, criteria, is_completed, completed_at, order_index, proof_url, verification_status",
      )
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      const saved = mapMilestoneRow(data as Record<string, unknown>);
      await syncGoalCompletionStatus(saved.goal_id);
      return saved;
    }
  }

  await syncGoalCompletionStatus(updated.goal_id);
  return updated;
}

async function syncGoalCompletionStatus(goalId: string): Promise<void> {
  const milestones = readLocalMilestones().filter((item) => item.goal_id === goalId);
  const allComplete = milestones.length > 0 && milestones.every((item) => item.is_completed);
  const status: GoalStatus = allComplete ? "completed" : "in_progress";

  writeLocalGoals(
    readLocalGoals().map((goal) => (goal.id === goalId ? { ...goal, status } : goal)),
  );

  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from("goals").update({ status }).eq("id", goalId);

  const goal = readLocalGoals().find((item) => item.id === goalId);
  if (goal && allComplete) {
    await supabase.from("hope_posts").update({ hope_status: "fulfilled" }).eq("id", goal.post_id);
  }
}

function readLocalStepChats(): StepChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STEP_CHATS_KEY);
    return raw ? (JSON.parse(raw) as StepChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStepChats(messages: StepChatMessage[]) {
  if (typeof window === "undefined") return;
  const slim = messages.map(slimChatForLocalStorage).slice(-MAX_LOCAL_STEP_CHATS);
  try {
    localStorage.setItem(LOCAL_STEP_CHATS_KEY, JSON.stringify(slim));
    return;
  } catch {
    // Retry with text-only cache when inline proof images filled storage.
  }
  try {
    const textOnly = slim
      .map((message) => ({
        ...message,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
      }))
      .slice(-40);
    localStorage.setItem(LOCAL_STEP_CHATS_KEY, JSON.stringify(textOnly));
  } catch {
    // Skip local cache — Supabase or in-memory state remains authoritative.
  }
}

const STEP_CHAT_FULL_SELECT =
  "id, milestone_id, role, content, created_at, attachment_url, attachment_type, attachment_name";
const STEP_CHAT_BASE_SELECT = "id, milestone_id, role, content, created_at";

function mapStepChatRow(row: Record<string, unknown>): StepChatMessage {
  return {
    id: String(row.id),
    milestone_id: String(row.milestone_id),
    role: row.role as StepChatMessage["role"],
    content: String(row.content),
    created_at: String(row.created_at),
    attachment_url: row.attachment_url ? String(row.attachment_url) : null,
    attachment_type: row.attachment_type
      ? (String(row.attachment_type) as StepChatMessage["attachment_type"])
      : null,
    attachment_name: row.attachment_name ? String(row.attachment_name) : null,
  };
}

function inferAttachmentType(file: File): StepChatMessage["attachment_type"] {
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

export function proofChatLogContent(file: File): string {
  return file.type.startsWith("image/")
    ? "Uploaded proof image for verification"
    : `Uploaded proof document for verification (${file.name})`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.onerror = () => reject(new Error("Could not read proof file."));
    reader.readAsDataURL(file);
  });
}

export async function fetchStepChats(milestoneId: string): Promise<StepChatMessage[]> {
  const local = readLocalStepChats().filter((msg) => msg.milestone_id === milestoneId);
  const supabase = getSupabase();
  if (!supabase) return local.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const full = await supabase
    .from("step_chats")
    .select(STEP_CHAT_FULL_SELECT)
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: true });

  let remote: StepChatMessage[] = [];
  if (!full.error && full.data) {
    remote = full.data.map((row) => mapStepChatRow(row as Record<string, unknown>));
  } else if (full.error && isSchemaMismatchError(full.error.message)) {
    const fallback = await supabase
      .from("step_chats")
      .select(STEP_CHAT_BASE_SELECT)
      .eq("milestone_id", milestoneId)
      .order("created_at", { ascending: true });
    if (!fallback.error && fallback.data) {
      remote = fallback.data.map((row) => mapStepChatRow(row as Record<string, unknown>));
    }
  }

  if (remote.length === 0 && !full.error) return local;

  const merged = new Map<string, StepChatMessage>();
  for (const msg of [...local, ...remote]) merged.set(msg.id, msg);
  return Array.from(merged.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function persistStepChat(message: StepChatMessage): Promise<StepChatMessage> {
  writeLocalStepChats([...readLocalStepChats(), message]);

  const supabase = getSupabase();
  if (!supabase) return message;

  const payload = {
    milestone_id: message.milestone_id,
    role: message.role,
    content: message.content,
    attachment_url: message.attachment_url ?? null,
    attachment_type: message.attachment_type ?? null,
    attachment_name: message.attachment_name ?? null,
  };

  const full = await supabase
    .from("step_chats")
    .insert(payload)
    .select(STEP_CHAT_FULL_SELECT)
    .single();

  if (!full.error && full.data) {
    const saved = mapStepChatRow(full.data as Record<string, unknown>);
    writeLocalStepChats([...readLocalStepChats().filter((item) => item.id !== message.id), saved]);
    return saved;
  }

  if (full.error && isSchemaMismatchError(full.error.message)) {
    const fallback = await supabase
      .from("step_chats")
      .insert({
        milestone_id: message.milestone_id,
        role: message.role,
        content: message.content,
      })
      .select(STEP_CHAT_BASE_SELECT)
      .single();

    if (!fallback.error && fallback.data) {
      const saved = mapStepChatRow(fallback.data as Record<string, unknown>);
      writeLocalStepChats([
        ...readLocalStepChats().filter((item) => item.id !== message.id),
        saved,
      ]);
      return saved;
    }
  }

  return message;
}

export async function postProofToStepChat(input: {
  milestoneId: string;
  proofUrl: string;
  file: File;
}): Promise<StepChatMessage> {
  const message: StepChatMessage = {
    id: createLocalId("chat"),
    milestone_id: input.milestoneId,
    role: "system",
    content: proofChatLogContent(input.file),
    attachment_url: input.proofUrl,
    attachment_type: inferAttachmentType(input.file),
    attachment_name: input.file.name,
    created_at: new Date().toISOString(),
  };
  return persistStepChat(message);
}

const MAX_INLINE_PROOF_BYTES = 3 * 1024 * 1024;

export async function uploadStepProof(
  userId: string,
  milestoneId: string,
  file: File,
): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    return fileToDataUrl(file);
  }

  try {
    const attachment = await uploadHopePostAttachment(file, userId);
    return attachment.url;
  } catch {
    if (file.size <= MAX_INLINE_PROOF_BYTES) {
      return fileToDataUrl(file);
    }
    throw new Error(
      "Could not upload proof. Create the post-attachments bucket in Supabase or use a smaller file.",
    );
  }
}

export async function persistStepProofUrl(
  milestoneId: string,
  proofUrl: string,
): Promise<GoalMilestone> {
  writeProofUrlToCache(milestoneId, proofUrl);
  const updated = await updateMilestoneFields(milestoneId, { proof_url: proofUrl });
  if (!updated) throw new Error("Milestone not found.");
  return updated;
}

async function updateMilestoneFields(
  milestoneId: string,
  fields: Partial<
    Pick<
      GoalMilestone,
      "title" | "criteria" | "proof_url" | "verification_status" | "is_completed" | "completed_at"
    >
  >,
): Promise<GoalMilestone | null> {
  const target = await loadMilestoneById(milestoneId);
  if (!target) return null;

  if (fields.proof_url) writeProofUrlToCache(milestoneId, fields.proof_url);

  const updated: GoalMilestone = { ...target, ...fields };
  upsertLocalMilestone(updated);

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("goal_milestones")
      .update(fields)
      .eq("id", milestoneId)
      .select(
        "id, goal_id, title, criteria, is_completed, completed_at, order_index, proof_url, verification_status",
      )
      .maybeSingle();

    if (error) {
      if (isSchemaMismatchError(error.message)) {
        if (updated.is_completed) await syncGoalCompletionStatus(updated.goal_id);
        return hydrateMilestoneProofs([updated])[0] ?? updated;
      }
      throw new Error(error.message);
    }
    if (data) {
      const saved = hydrateMilestoneProofs([mapMilestoneRow(data as Record<string, unknown>)])[0]!;
      upsertLocalMilestone(saved);
      if (saved.is_completed) await syncGoalCompletionStatus(saved.goal_id);
      return saved;
    }
  }

  if (updated.is_completed) await syncGoalCompletionStatus(updated.goal_id);
  return hydrateMilestoneProofs([updated])[0] ?? updated;
}

export async function verifyStepProof(input: {
  milestone: GoalMilestone;
  proofFile: File;
}): Promise<{ milestone: GoalMilestone; result: VerifyStepProofResult }> {
  const base64 = await fileToBase64(input.proofFile);
  const result = await verifyGoalStepProofServer({
    data: {
      stepTitle: input.milestone.title,
      criteria: input.milestone.criteria ?? input.milestone.title,
      proofBase64: base64,
      mimeType: input.proofFile.type || "image/jpeg",
    },
  });

  const verification_status: StepVerificationStatus = result.verified ? "verified" : "rejected";
  const updated = await updateMilestoneFields(input.milestone.id, {
    proof_url: input.milestone.proof_url ?? null,
    verification_status,
    is_completed: result.verified,
    completed_at: result.verified ? new Date().toISOString() : null,
  });

  if (!updated) throw new Error("Milestone not found.");
  return { milestone: updated, result };
}

export async function negotiateGoalStep(input: {
  goalTitle: string;
  milestone: GoalMilestone;
  userMessage: string;
  history: StepChatMessage[];
}): Promise<{
  milestone: GoalMilestone;
  result: NegotiateStepResult;
  messages: StepChatMessage[];
  rateLimited?: boolean;
}> {
  const userMsg: StepChatMessage = {
    id: createLocalId("chat"),
    milestone_id: input.milestone.id,
    role: "user",
    content: input.userMessage,
    created_at: new Date().toISOString(),
  };

  let savedUser = userMsg;
  try {
    savedUser = await persistStepChat(userMsg);
  } catch (error) {
    if (!isBrowserStorageQuotaError(error)) throw error;
  }

  const proofImageUrls = [
    ...input.history
      .filter((msg) => msg.attachment_type === "image" && msg.attachment_url)
      .map((msg) => msg.attachment_url as string),
    ...(input.milestone.proof_url ? [input.milestone.proof_url] : []),
  ].filter((url, index, all) => all.indexOf(url) === index);

  let result: NegotiateStepResult;
  let rateLimited = false;

  try {
    result = await negotiateGoalStepServer({
      data: {
        goalTitle: input.goalTitle,
        stepTitle: input.milestone.title,
        criteria: input.milestone.criteria ?? input.milestone.title,
        userMessage: input.userMessage,
        history: [...input.history, savedUser],
        proofImageUrls,
      },
    });
    if (result.assistant_reply.startsWith("Rate limit reached")) {
      rateLimited = true;
    }
  } catch (error) {
    rateLimited = isStepChatRateLimitError(error);
    result = {
      accepted: false,
      title: input.milestone.title,
      criteria: input.milestone.criteria ?? input.milestone.title,
      assistant_reply: rateLimited
        ? "Rate limit reached. Please wait a moment before sending another request."
        : "I couldn't reach the AI coach right now, but your message was saved. Try again shortly.",
    };
  }

  const assistantMsg: StepChatMessage = {
    id: createLocalId("chat"),
    milestone_id: input.milestone.id,
    role: "assistant",
    content: result.assistant_reply,
    created_at: new Date().toISOString(),
  };

  let savedAssistant = assistantMsg;
  try {
    savedAssistant = await persistStepChat(assistantMsg);
  } catch (error) {
    if (!isBrowserStorageQuotaError(error)) throw error;
  }

  let updatedMilestone = input.milestone;
  if (result.accepted) {
    try {
      const saved = await updateMilestoneFields(input.milestone.id, {
        title: result.title,
        criteria: result.criteria,
      });
      if (saved) updatedMilestone = saved;
    } catch (error) {
      const message = readErrorMessage(error);
      if (!isBrowserStorageQuotaError(error) && !isSchemaMismatchError(message)) {
        throw error;
      }
    }
  }

  return {
    milestone: updatedMilestone,
    result,
    messages: [...input.history, savedUser, savedAssistant],
    rateLimited,
  };
}

export function isStepUnlocked(milestones: GoalMilestone[], index: number): boolean {
  if (index === 0) return true;
  const prev = milestones[index - 1];
  return Boolean(prev?.is_completed && prev.verification_status !== "rejected");
}
