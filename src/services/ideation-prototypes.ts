import { buildCodeBundleFromHtml, filterPublicEnvVars } from "@/lib/prototype-sandbox";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  IdeationCodeBundle,
  IdeationComment,
  IdeationPrototype,
  PublishIdeationPrototypeInput,
  SaveIdeationPrototypeInput,
} from "@/types/ideation";

const EMPTY_BUNDLE: IdeationCodeBundle = { format: "html", entry: "index.html", files: {} };

const LOCAL_PROTOTYPES_KEY = "pivoton-ideation-prototypes";
const LOCAL_COMMENTS_KEY = "pivoton-ideation-comments";
const LOCAL_RATINGS_KEY = "pivoton-ideation-ratings";

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-proto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSchemaMismatchError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("column")
  );
}

function normalizeLocalPrototype(raw: IdeationPrototype): IdeationPrototype {
  const htmlPreview = raw.html_preview ?? "";
  return {
    ...raw,
    html_preview: htmlPreview,
    code_bundle:
      raw.code_bundle && Object.keys(raw.code_bundle.files ?? {}).length > 0
        ? raw.code_bundle
        : buildCodeBundleFromHtml(htmlPreview),
    env_vars: raw.env_vars ?? {},
    status: raw.status ?? (raw.is_published ? "published" : "draft"),
    monetization_tier: raw.monetization_tier ?? (raw.is_published ? "active" : "free"),
  };
}

function readLocalPrototypes(): IdeationPrototype[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PROTOTYPES_KEY);
    const parsed = raw ? (JSON.parse(raw) as IdeationPrototype[]) : [];
    return parsed.map(normalizeLocalPrototype);
  } catch {
    return [];
  }
}

function writeLocalPrototypes(prototypes: IdeationPrototype[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PROTOTYPES_KEY, JSON.stringify(prototypes));
  } catch {
    // Best-effort cache.
  }
}

function readLocalComments(): IdeationComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? (JSON.parse(raw) as IdeationComment[]) : [];
  } catch {
    return [];
  }
}

function writeLocalComments(comments: IdeationComment[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  } catch {
    // Best-effort cache.
  }
}

function readLocalRatings(): Array<{ prototype_id: string; user_id: string; rating: number }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_RATINGS_KEY);
    return raw ? (JSON.parse(raw) as Array<{ prototype_id: string; user_id: string; rating: number }>) : [];
  } catch {
    return [];
  }
}

function writeLocalRatings(
  ratings: Array<{ prototype_id: string; user_id: string; rating: number }>,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_RATINGS_KEY, JSON.stringify(ratings));
  } catch {
    // Best-effort cache.
  }
}

function parseCodeBundle(raw: unknown, htmlPreview: string): IdeationCodeBundle {
  if (raw && typeof raw === "object" && "files" in raw) {
    const bundle = raw as IdeationCodeBundle;
    if (bundle.files && Object.keys(bundle.files).length > 0) return bundle;
  }
  if (htmlPreview.trim()) return buildCodeBundleFromHtml(htmlPreview);
  return EMPTY_BUNDLE;
}

function parseEnvVars(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => [k, String(v)]),
  );
}

function rowToPrototype(row: Record<string, unknown>): IdeationPrototype {
  const htmlPreview = String(row.html_preview ?? "");
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    author_name: String(row.author_name ?? "Member"),
    author_avatar: row.author_avatar ? String(row.author_avatar) : null,
    title: String(row.title ?? "Untitled prototype"),
    description: String(row.description ?? ""),
    html_preview: htmlPreview,
    code_bundle: parseCodeBundle(row.code_bundle, htmlPreview),
    env_vars: parseEnvVars(row.env_vars),
    status: row.status === "published" ? "published" : "draft",
    monetization_tier: row.monetization_tier === "active" ? "active" : "free",
    recommended_api_ids: Array.isArray(row.recommended_api_ids)
      ? (row.recommended_api_ids as string[])
      : [],
    messages: Array.isArray(row.messages) ? (row.messages as IdeationPrototype["messages"]) : [],
    is_published: Boolean(row.is_published) || row.status === "published",
    published_at: row.published_at ? String(row.published_at) : null,
    rating_sum: Number(row.rating_sum ?? 0),
    rating_count: Number(row.rating_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mergePrototypes(remote: IdeationPrototype[], local: IdeationPrototype[]): IdeationPrototype[] {
  const map = new Map<string, IdeationPrototype>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing || new Date(item.updated_at) >= new Date(existing.updated_at)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function readIdeationPrototypesFromLocalStorage(): IdeationPrototype[] {
  return readLocalPrototypes();
}

export async function fetchPublishedPrototypes(): Promise<IdeationPrototype[]> {
  const localPublished = readLocalPrototypes().filter((p) => p.is_published);
  const supabase = getSupabase();

  if (!isSupabaseConfigured || !supabase) {
    return localPublished.sort(
      (a, b) =>
        new Date(b.published_at ?? b.updated_at).getTime() -
        new Date(a.published_at ?? a.updated_at).getTime(),
    );
  }

  const { data, error } = await supabase
    .from("ideation_prototypes")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) {
    if (isSchemaMismatchError(error)) return localPublished;
    throw new Error(error.message);
  }

  const remote = (data ?? []).map((row) => rowToPrototype(row as Record<string, unknown>));
  const merged = mergePrototypes(remote, localPublished).filter((p) => p.is_published);
  writeLocalPrototypes(mergePrototypes(readLocalPrototypes(), merged));
  return merged.sort(
    (a, b) =>
      new Date(b.published_at ?? b.updated_at).getTime() -
      new Date(a.published_at ?? a.updated_at).getTime(),
  );
}

export async function fetchUserPrototypes(
  userId: string,
  options?: { publishedOnly?: boolean },
): Promise<IdeationPrototype[]> {
  const local = readLocalPrototypes().filter((p) => {
    if (p.user_id !== userId) return false;
    if (options?.publishedOnly) return p.is_published;
    return true;
  });

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) {
    return local.sort(
      (a, b) =>
        new Date(b.published_at ?? b.updated_at).getTime() -
        new Date(a.published_at ?? a.updated_at).getTime(),
    );
  }

  let query = supabase.from("ideation_prototypes").select("*").eq("user_id", userId);
  if (options?.publishedOnly) query = query.eq("is_published", true);

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    if (isSchemaMismatchError(error)) return local;
    throw new Error(error.message);
  }

  const remote = (data ?? []).map((row) => rowToPrototype(row as Record<string, unknown>));
  const merged = mergePrototypes(remote, local).filter((p) => p.user_id === userId);
  if (options?.publishedOnly) {
    return merged.filter((p) => p.is_published);
  }
  writeLocalPrototypes(mergePrototypes(readLocalPrototypes(), merged));
  return merged;
}

export async function saveIdeationPrototype(
  input: SaveIdeationPrototypeInput,
): Promise<IdeationPrototype> {
  const now = new Date().toISOString();
  const id = input.id ?? createLocalId();
  const existing = readLocalPrototypes().find((p) => p.id === id);

  const codeBundle =
    input.code_bundle && Object.keys(input.code_bundle.files).length > 0
      ? input.code_bundle
      : buildCodeBundleFromHtml(input.html_preview);

  const prototype: IdeationPrototype = {
    id,
    user_id: input.user_id,
    author_name: input.author_name,
    author_avatar: input.author_avatar ?? null,
    title: input.title.trim() || "Untitled prototype",
    description: input.description.trim(),
    html_preview: input.html_preview,
    code_bundle: codeBundle,
    env_vars: input.env_vars ?? existing?.env_vars ?? {},
    status: input.status ?? existing?.status ?? "draft",
    monetization_tier: input.monetization_tier ?? existing?.monetization_tier ?? "free",
    recommended_api_ids: input.recommended_api_ids,
    messages: input.messages,
    is_published: existing?.is_published ?? false,
    published_at: existing?.published_at ?? null,
    rating_sum: existing?.rating_sum ?? 0,
    rating_count: existing?.rating_count ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const local = readLocalPrototypes();
  const index = local.findIndex((p) => p.id === id);
  if (index >= 0) local[index] = prototype;
  else local.unshift(prototype);
  writeLocalPrototypes(local);

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) return prototype;

  const payload = {
    id: prototype.id,
    user_id: prototype.user_id,
    author_name: prototype.author_name,
    author_avatar: prototype.author_avatar,
    title: prototype.title,
    description: prototype.description,
    html_preview: prototype.html_preview,
    code_bundle: prototype.code_bundle,
    env_vars: prototype.env_vars,
    status: prototype.status,
    monetization_tier: prototype.monetization_tier,
    recommended_api_ids: prototype.recommended_api_ids,
    messages: prototype.messages,
    is_published: prototype.is_published,
    published_at: prototype.published_at,
    rating_sum: prototype.rating_sum,
    rating_count: prototype.rating_count,
    updated_at: prototype.updated_at,
  };

  const { data, error } = await supabase
    .from("ideation_prototypes")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    if (isSchemaMismatchError(error)) return prototype;
    throw new Error(error.message);
  }

  return rowToPrototype(data as Record<string, unknown>);
}

export async function publishIdeationPrototype(
  input: PublishIdeationPrototypeInput,
): Promise<IdeationPrototype> {
  const now = new Date().toISOString();
  const local = readLocalPrototypes();
  const index = local.findIndex((p) => p.id === input.id);
  if (index < 0) throw new Error("Prototype not found. Save it first.");

  const publicEnvVars = filterPublicEnvVars(input.env_vars ?? local[index]!.env_vars);
  const codeBundle =
    input.code_bundle && Object.keys(input.code_bundle.files).length > 0
      ? input.code_bundle
      : local[index]!.code_bundle;

  const updated: IdeationPrototype = {
    ...local[index]!,
    title: input.title.trim() || local[index]!.title,
    description: input.description.trim() || local[index]!.description,
    code_bundle: codeBundle,
    env_vars: publicEnvVars,
    status: "published",
    monetization_tier: input.monetization_tier ?? "active",
    is_published: true,
    published_at: now,
    updated_at: now,
  };
  local[index] = updated;
  writeLocalPrototypes(local);

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) return updated;

  const { data, error } = await supabase
    .from("ideation_prototypes")
    .update({
      title: updated.title,
      description: updated.description,
      code_bundle: updated.code_bundle,
      env_vars: updated.env_vars,
      status: "published",
      monetization_tier: updated.monetization_tier,
      is_published: true,
      published_at: now,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    if (isSchemaMismatchError(error)) return updated;
    throw new Error(error.message);
  }

  return rowToPrototype(data as Record<string, unknown>);
}

export async function rateIdeationPrototype(
  prototypeId: string,
  userId: string,
  rating: number,
): Promise<IdeationPrototype> {
  const clamped = Math.min(5, Math.max(1, Math.round(rating)));
  const local = readLocalPrototypes();
  const index = local.findIndex((p) => p.id === prototypeId);
  if (index < 0) throw new Error("Prototype not found.");

  const ratings = readLocalRatings();
  const ratingIndex = ratings.findIndex(
    (r) => r.prototype_id === prototypeId && r.user_id === userId,
  );
  const previous = ratingIndex >= 0 ? ratings[ratingIndex]!.rating : 0;

  if (ratingIndex >= 0) ratings[ratingIndex]!.rating = clamped;
  else ratings.push({ prototype_id: prototypeId, user_id: userId, rating: clamped });
  writeLocalRatings(ratings);

  const proto = local[index]!;
  proto.rating_sum = proto.rating_sum - previous + clamped;
  proto.rating_count = previous > 0 ? proto.rating_count : proto.rating_count + 1;
  local[index] = proto;
  writeLocalPrototypes(local);

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) return proto;

  await supabase.from("ideation_ratings").upsert(
    { prototype_id: prototypeId, user_id: userId, rating: clamped },
    { onConflict: "prototype_id,user_id" },
  );

  const { data: ratingRows } = await supabase
    .from("ideation_ratings")
    .select("rating")
    .eq("prototype_id", prototypeId);

  const sum = (ratingRows ?? []).reduce((acc, row) => acc + Number(row.rating), 0);
  const count = ratingRows?.length ?? proto.rating_count;

  const { data, error } = await supabase
    .from("ideation_prototypes")
    .update({ rating_sum: sum, rating_count: count, updated_at: new Date().toISOString() })
    .eq("id", prototypeId)
    .select("*")
    .single();

  if (error) {
    if (isSchemaMismatchError(error)) return proto;
    throw new Error(error.message);
  }

  const synced = rowToPrototype(data as Record<string, unknown>);
  local[index] = synced;
  writeLocalPrototypes(local);
  return synced;
}

export function getUserRatingForPrototype(prototypeId: string, userId: string): number | null {
  const match = readLocalRatings().find(
    (r) => r.prototype_id === prototypeId && r.user_id === userId,
  );
  return match?.rating ?? null;
}

export async function fetchPrototypeComments(prototypeId: string): Promise<IdeationComment[]> {
  const local = readLocalComments()
    .filter((c) => c.prototype_id === prototypeId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) return local;

  const { data, error } = await supabase
    .from("ideation_comments")
    .select("*")
    .eq("prototype_id", prototypeId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isSchemaMismatchError(error)) return local;
    throw new Error(error.message);
  }

  const remote = (data ?? []).map(
    (row): IdeationComment => ({
      id: String(row.id),
      prototype_id: String(row.prototype_id),
      user_id: String(row.user_id),
      author_name: String(row.author_name),
      author_avatar: row.author_avatar ? String(row.author_avatar) : null,
      content: String(row.content),
      created_at: String(row.created_at),
    }),
  );

  const merged = [...new Map([...local, ...remote].map((c) => [c.id, c])).values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  writeLocalComments(merged);
  return merged;
}

export async function addPrototypeComment(input: {
  prototype_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
}): Promise<IdeationComment> {
  const comment: IdeationComment = {
    id: createLocalId(),
    prototype_id: input.prototype_id,
    user_id: input.user_id,
    author_name: input.author_name,
    author_avatar: input.author_avatar ?? null,
    content: input.content.trim(),
    created_at: new Date().toISOString(),
  };

  const comments = readLocalComments();
  comments.push(comment);
  writeLocalComments(comments);

  const supabase = getSupabase();
  if (!isSupabaseConfigured || !supabase) return comment;

  const { data, error } = await supabase
    .from("ideation_comments")
    .insert({
      id: comment.id,
      prototype_id: comment.prototype_id,
      user_id: comment.user_id,
      author_name: comment.author_name,
      author_avatar: comment.author_avatar,
      content: comment.content,
    })
    .select("*")
    .single();

  if (error) {
    if (isSchemaMismatchError(error)) return comment;
    throw new Error(error.message);
  }

  return {
    id: String(data.id),
    prototype_id: String(data.prototype_id),
    user_id: String(data.user_id),
    author_name: String(data.author_name),
    author_avatar: data.author_avatar ? String(data.author_avatar) : null,
    content: String(data.content),
    created_at: String(data.created_at),
  };
}

export function derivePrototypeMetadata(
  messages: Array<{ role: string; content: string; recommendedApiIds?: string[] }>,
  htmlPreview: string,
): { title: string; description: string; recommendedApiIds: string[] } {
  const firstUser = messages.find((m) => m.role === "user")?.content.trim() ?? "";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.content.trim() ?? "";

  const title =
    firstUser.length > 60 ? `${firstUser.slice(0, 57)}…` : firstUser || "Untitled prototype";

  const description =
    lastAssistant.slice(0, 280) + (lastAssistant.length > 280 ? "…" : "") ||
    "AI-generated MVP prototype.";

  const recommendedApiIds = new Set<string>();
  for (const msg of messages) {
    if (Array.isArray(msg.recommendedApiIds)) {
      for (const id of msg.recommendedApiIds) recommendedApiIds.add(id);
    }
  }

  if (recommendedApiIds.size === 0 && htmlPreview) {
    const lower = htmlPreview.toLowerCase();
    if (lower.includes("stripe")) recommendedApiIds.add("stripe");
    if (lower.includes("supabase")) recommendedApiIds.add("supabase");
    if (lower.includes("plaid")) recommendedApiIds.add("plaid");
    if (lower.includes("mapbox")) recommendedApiIds.add("mapbox");
  }

  return {
    title,
    description,
    recommendedApiIds: [...recommendedApiIds],
  };
}
