import { generateSeedHopeComments } from "@/data/seed-hope-comments";
import { generateSeedHopePosts } from "@/data/seed-hope-posts";
import {
  attachmentsFromImageUrls,
  filterPersistableAttachments,
  imageUrlsFromAttachments,
  isInlinePlaceholderUrl,
  isLoadableAttachmentUrl,
  isPersistableAttachmentUrl,
  parseHopeAttachments,
  resolveHopePostAttachments,
} from "@/lib/hope-attachment-utils";
import { enrichHopePostsWithMedia } from "@/lib/hope-post-media";
import { parseMarketplaceLinksFromRow } from "@/lib/hope-post-marketplace";
import { extractMarketplaceLink, extractMarketplaceLinks } from "@/lib/shop-link-parser";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { HopeComment, HopePost, HopePostAttachment, HopeStatus } from "@/types/hope-post";

const LOCAL_POSTS_KEY = "pivoton-hope-posts";
const LOCAL_COMMENTS_KEY = "pivoton-hope-comments";
const LOCAL_SEED_KEY = "pivoton-hope-seeded-v2";
const LOCAL_ATTACHMENT_BLOBS_KEY = "pivoton-hope-attachment-blobs";
/** Durable https attachment URLs keyed by post id — survives fetch/sync overwrites. */
const LOCAL_ATTACHMENT_CACHE_KEY = "pivoton-hope-attachment-cache";
/** Optimistic posts while Supabase insert/sync is in flight — survives hard refresh. */
const LOCAL_PENDING_POSTS_KEY = "pivoton-hope-posts-pending";
const INLINE_ATTACHMENT_URL_PREFIX = "inline://";

export const hopeQueryKeys = {
  posts: ["hope-posts"] as const,
  comments: ["hope-comments"] as const,
  userPosts: (userId: string, authorName?: string | null) =>
    ["user-hopes", userId, authorName ?? null] as const,
};

let localSeedEnsured = false;

function readAttachmentBlobs(): Record<string, HopePostAttachment[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_ATTACHMENT_BLOBS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, HopePostAttachment[]>) : {};
  } catch {
    return {};
  }
}

function writeAttachmentBlobs(blobs: Record<string, HopePostAttachment[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_ATTACHMENT_BLOBS_KEY, JSON.stringify(blobs));
  } catch {
    const ids = Object.keys(blobs);
    if (ids.length <= 1) return;
    const trimmed = { [ids[ids.length - 1]]: blobs[ids[ids.length - 1]] };
    try {
      localStorage.setItem(LOCAL_ATTACHMENT_BLOBS_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore — attachments may not survive reload when storage is full.
    }
  }
}

function hasInlineAttachments(attachments?: HopePostAttachment[]): boolean {
  return Boolean(attachments?.some((attachment) => attachment.url.startsWith("data:")));
}

function readAttachmentCache(): Record<string, HopePostAttachment[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_ATTACHMENT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, HopePostAttachment[]>) : {};
  } catch {
    return {};
  }
}

function writeAttachmentCache(cache: Record<string, HopePostAttachment[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_ATTACHMENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort durable cache.
  }
}

function cachePostAttachments(postId: string, attachments: HopePostAttachment[]) {
  const persistable = filterPersistableAttachments(attachments);
  if (persistable.length === 0) return;

  const cache = readAttachmentCache();
  cache[postId] = mergeAttachmentLists(cache[postId], persistable) ?? persistable;
  writeAttachmentCache(cache);
}

function removeAttachmentCache(postId: string) {
  const cache = readAttachmentCache();
  if (!cache[postId]) return;
  delete cache[postId];
  writeAttachmentCache(cache);
}

function applyAttachmentCacheWith(
  post: HopePost,
  attachmentCache: Record<string, HopePostAttachment[]>,
): HopePost {
  const cached = attachmentCache[post.id];
  const resolved = resolveHopePostAttachments(post);
  const attachments = mergeAttachmentLists(resolved, cached) ?? cached ?? resolved;
  return normalizeHopePost({ ...post, attachments: attachments.length > 0 ? attachments : undefined });
}

function applyAttachmentCache(post: HopePost): HopePost {
  return applyAttachmentCacheWith(post, readAttachmentCache());
}

function pickBestAttachments(remote: HopePost, local: HopePost): HopePostAttachment[] | undefined {
  const cache = readAttachmentCache()[remote.id] ?? readAttachmentCache()[local.id];
  const remoteResolved = resolveHopePostAttachments(remote);
  const localResolved = resolveHopePostAttachments(local);
  const merged = mergeAttachmentLists(remoteResolved, localResolved, cache);
  if (merged?.length) return merged;

  if (localResolved.length >= remoteResolved.length) return localResolved.length > 0 ? localResolved : undefined;
  return remoteResolved.length > 0 ? remoteResolved : undefined;
}

function mergeAttachmentLists(
  ...lists: (HopePostAttachment[] | undefined)[]
): HopePostAttachment[] | undefined {
  const byUrl = new Map<string, HopePostAttachment>();

  for (const list of lists) {
    if (!list?.length) continue;
    for (const attachment of list) {
      if (isInlinePlaceholderUrl(attachment.url)) continue;
      if (!isLoadableAttachmentUrl(attachment.url)) continue;
      byUrl.set(attachment.url, attachment);
    }
  }

  const merged = Array.from(byUrl.values());
  return merged.length > 0 ? merged : undefined;
}

function withDerivedImageUrls(post: HopePost): HopePost {
  const attachments = resolveHopePostAttachments(post);
  const fromAttachments = imageUrlsFromAttachments(attachments);
  const image_urls =
    fromAttachments.length > 0
      ? fromAttachments
      : post.image_urls?.filter((url) => isLoadableAttachmentUrl(url));

  return {
    ...post,
    attachments: attachments.length > 0 ? attachments : undefined,
    image_urls: image_urls?.length ? image_urls : undefined,
  };
}

function normalizeHopePost(post: HopePost): HopePost {
  const normalized = withDerivedImageUrls(post);
  if (normalized.attachments?.length) {
    cachePostAttachments(normalized.id, normalized.attachments);
  }
  return normalized;
}

function hydrateLocalPost(post: HopePost): HopePost {
  const cached = readAttachmentCache()[post.id];
  if (cached?.length) {
    return withDerivedImageUrls({ ...post, attachments: mergeAttachmentLists(post.attachments, cached) ?? cached });
  }

  if (!post.attachments?.length) return applyAttachmentCache(withDerivedImageUrls(post));

  const blobs = readAttachmentBlobs();
  const blobAttachments = blobs[post.id];
  if (blobAttachments?.length) {
    return withDerivedImageUrls({
      ...post,
      attachments: blobAttachments,
    });
  }

  const resolved = post.attachments.filter((attachment) => !isInlinePlaceholderUrl(attachment.url));
  if (resolved.length > 0) {
    return withDerivedImageUrls({ ...post, attachments: resolved });
  }

  const fromLegacyUrls = attachmentsFromImageUrls(post.image_urls ?? []);
  if (fromLegacyUrls.length > 0) {
    return withDerivedImageUrls({ ...post, attachments: fromLegacyUrls });
  }

  return applyAttachmentCache(withDerivedImageUrls(post));
}

function postForLocalStorage(post: HopePost): HopePost {
  const normalized = withDerivedImageUrls(post);
  if (!hasInlineAttachments(normalized.attachments)) return normalized;

  const blobs = readAttachmentBlobs();
  blobs[normalized.id] = normalized.attachments!;
  writeAttachmentBlobs(blobs);

  return {
    ...normalized,
    attachments: normalized.attachments!.map((attachment) =>
      attachment.url.startsWith("data:")
        ? {
            ...attachment,
            url: `${INLINE_ATTACHMENT_URL_PREFIX}${normalized.id}/${encodeURIComponent(attachment.file_name)}`,
          }
        : attachment,
    ),
    image_urls: normalized.image_urls?.filter((url) => !url.startsWith("data:")),
  };
}

function writeLocalPosts(posts: HopePost[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
}

function writeLocalPostsSafe(posts: HopePost[]) {
  if (typeof window === "undefined") return;

  const slimPosts = posts.map(postForLocalStorage);

  try {
    writeLocalPosts(slimPosts);
    return;
  } catch {
    const withoutAttachments = slimPosts.map((post) => ({
      ...post,
      attachments: post.attachments?.filter((attachment) => !attachment.url.startsWith("data:")),
      image_urls: post.image_urls?.filter((url) => !url.startsWith("data:")),
    }));
    try {
      writeLocalPosts(withoutAttachments);
    } catch {
      // Post still appears in-session via React state even if persistence fails.
    }
  }
}

function readPendingPosts(): HopePost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PENDING_POSTS_KEY);
    const posts = raw ? (JSON.parse(raw) as HopePost[]) : [];
    return posts.map(hydrateLocalPost);
  } catch {
    return [];
  }
}

function writePendingPosts(posts: HopePost[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PENDING_POSTS_KEY, JSON.stringify(posts.map(postForLocalStorage)));
  } catch {
    // Best-effort optimistic cache only.
  }
}

function stagePendingHopePost(post: HopePost) {
  const pending = readPendingPosts().filter((entry) => entry.id !== post.id);
  pending.unshift(post);
  writePendingPosts(pending);
}

function clearPendingHopePost(postId: string) {
  const pending = readPendingPosts().filter((entry) => entry.id !== postId);
  writePendingPosts(pending);
}

/** Never persist a post with fewer attachments than cache / existing local copy. */
function reconcilePostForStorage(post: HopePost, existing?: HopePost): HopePost {
  const cached = readAttachmentCache()[post.id];
  const existingResolved = existing ? resolveHopePostAttachments(existing) : [];
  const postResolved = resolveHopePostAttachments(post);
  const attachments =
    mergeAttachmentLists(postResolved, existingResolved, cached) ??
    (existingResolved.length > 0 ? existingResolved : undefined) ??
    (cached?.length ? cached : undefined);

  return applyAttachmentCache({
    ...post,
    attachments,
  });
}

function syncLocalPostsCache(posts: HopePost[]) {
  const existingById = new Map(readLocalPosts().map((post) => [post.id, post]));
  const safePosts = posts.map((post) => reconcilePostForStorage(post, existingById.get(post.id)));
  writeLocalPostsSafe(safePosts);
}

function persistLocalPost(post: HopePost) {
  replaceLocalPost(withDerivedImageUrls(post));
}

function replaceLocalPost(post: HopePost) {
  const posts = readLocalPosts();
  const normalized = withDerivedImageUrls(post);
  const index = posts.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) posts[index] = normalized;
  else posts.unshift(normalized);
  if (normalized.attachments?.length) {
    cachePostAttachments(normalized.id, normalized.attachments);
  }
  writeLocalPostsSafe(posts);
}

function deleteLocalPost(postId: string) {
  const posts = readLocalPosts().filter((entry) => entry.id !== postId);
  writeLocalPostsSafe(posts);
  removeAttachmentCache(postId);

  const blobs = readAttachmentBlobs();
  if (blobs[postId]) {
    delete blobs[postId];
    writeAttachmentBlobs(blobs);
  }
}

function readLocalPosts(): HopePost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    const posts = raw ? (JSON.parse(raw) as HopePost[]) : [];
    return posts.map(hydrateLocalPost);
  } catch {
    return [];
  }
}

function readLocalComments(): HopeComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? (JSON.parse(raw) as HopeComment[]) : [];
  } catch {
    return [];
  }
}

function writeLocalComments(comments: HopeComment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
}

function mapCommentRow(row: Record<string, unknown>): HopeComment {
  return {
    id: String(row.id),
    post_id: String(row.post_id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    user_id: String(row.user_id),
    author_name: String(row.author_name),
    author_avatar: row.author_avatar ? String(row.author_avatar) : null,
    job_role: row.job_role ? String(row.job_role) : null,
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

function mapRow(row: Record<string, unknown>): HopePost {
  const attachments = parseHopeAttachments(row.attachments);
  const legacyImages = Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [];
  const image_urls =
    imageUrlsFromAttachments(attachments).length > 0
      ? imageUrlsFromAttachments(attachments)
      : legacyImages.length > 0
        ? legacyImages
        : undefined;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    author_name: String(row.author_name),
    author_avatar: row.author_avatar ? String(row.author_avatar) : null,
    job_role: row.job_role ? String(row.job_role) : null,
    content: String(row.content),
    likes_count: Number(row.likes_count ?? 0),
    created_at: String(row.created_at),
    edited_at: row.edited_at ? String(row.edited_at) : null,
    hope_status: (row.hope_status as HopeStatus | null) ?? null,
    attachments: attachments.length > 0 ? attachments : undefined,
    marketplace_link: row.marketplace_link ? String(row.marketplace_link) : null,
    marketplace_links: parseMarketplaceLinksFromRow(row),
    image_urls,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    location_label: row.location_label ? String(row.location_label) : null,
  };
}

function resolveMarketplaceFields(input: {
  content: string;
  marketplace_link?: string | null;
  marketplace_links?: string[];
}) {
  const marketplace_links =
    input.marketplace_links && input.marketplace_links.length > 0
      ? input.marketplace_links
      : extractMarketplaceLinks(input.content);
  const marketplace_link =
    input.marketplace_link ?? marketplace_links[0] ?? extractMarketplaceLink(input.content);

  return {
    marketplace_links,
    marketplace_link,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mergeHopePost(remote: HopePost, local: HopePost): HopePost {
  const attachments = pickBestAttachments(remote, local);
  const remoteLinks = remote.marketplace_links ?? [];
  const localLinks = local.marketplace_links ?? [];
  const marketplace_links = localLinks.length >= remoteLinks.length ? localLinks : remoteLinks;
  const remoteEdited = remote.edited_at ? new Date(remote.edited_at).getTime() : 0;
  const localEdited = local.edited_at ? new Date(local.edited_at).getTime() : 0;
  const preferLocalContent = localEdited >= remoteEdited;

  const merged = withDerivedImageUrls({
    ...remote,
    ...local,
    content: preferLocalContent ? local.content : remote.content,
    edited_at: localEdited >= remoteEdited ? local.edited_at ?? remote.edited_at : remote.edited_at,
    attachments,
    marketplace_links: marketplace_links.length > 0 ? marketplace_links : undefined,
    marketplace_link: local.marketplace_link ?? remote.marketplace_link,
  });

  if (merged.attachments?.length) {
    cachePostAttachments(merged.id, merged.attachments);
  }

  return merged;
}

function mergePosts(remote: HopePost[], local: HopePost[]): HopePost[] {
  const map = new Map<string, HopePost>();
  for (const post of remote) map.set(post.id, withDerivedImageUrls(post));
  for (const post of local) {
    const existing = map.get(post.id);
    map.set(post.id, existing ? mergeHopePost(existing, post) : withDerivedImageUrls(post));
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function sortPosts(posts: HopePost[]): HopePost[] {
  return [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

let seedHopePostsPromise: Promise<void> | null = null;

/** Synchronous local seed so cold starts can render posts before any network I/O. */
export function ensureLocalHopeSeedSync(): void {
  if (typeof window === "undefined" || localSeedEnsured) return;

  let local = readLocalPosts();
  let localComments = readLocalComments();
  const needsPosts = local.length < 15;
  const needsComments = localComments.length < 20;

  if (needsPosts) {
    const seed = generateSeedHopePosts();
    const existingIds = new Set(local.map((p) => p.id));
    local = sortPosts([...local, ...seed.filter((p) => !existingIds.has(p.id))]);
    writeLocalPostsSafe(local);
  }

  if (needsComments) {
    const commentSeed = generateSeedHopeComments();
    const existingCommentIds = new Set(localComments.map((c) => c.id));
    localComments = [
      ...localComments,
      ...commentSeed.filter((c) => !existingCommentIds.has(c.id)),
    ];
    writeLocalComments(localComments);
  }

  localSeedEnsured = true;
}

function filterPostsForUser(
  all: HopePost[],
  userId: string,
  authorName?: string | null,
): HopePost[] {
  const targetUserId = userId.trim().toLowerCase();
  const byUserId = all.filter((post) => post.user_id.trim().toLowerCase() === targetUserId);

  const authorKey = authorName?.trim().toLowerCase();
  if (!authorKey) return byUserId;

  const orphanPosts = all.filter(
    (post) =>
      post.user_id.trim().toLowerCase() !== targetUserId &&
      post.author_name.trim().toLowerCase() === authorKey &&
      (post.id.startsWith("local-") || !isUuid(post.user_id)),
  );

  return orphanPosts.length > 0 ? mergePosts(byUserId, orphanPosts) : byUserId;
}

/** Instant profile timeline from cached feed posts — no network. */
export function readUserHopePostsFromLocalStorage(
  userId: string,
  authorName?: string | null,
): HopePost[] {
  ensureLocalHopeSeedSync();
  const attachmentCache = readAttachmentCache();
  const all = sortPosts(
    [...readLocalPosts(), ...readPendingPosts()].map((post) =>
      applyAttachmentCacheWith(post, attachmentCache),
    ),
  );
  return sortPosts(
    enrichHopePostsWithMedia(filterPostsForUser(all, userId, authorName)).map((post) =>
      normalizeHopePost(post),
    ),
  );
}

/** Seeds localStorage with mock posts and comment threads when data is missing. */
async function seedHopePostsIfEmptyInternal(): Promise<void> {
  ensureLocalHopeSeedSync();
  if (typeof window === "undefined") return;

  let local = readLocalPosts();
  let localComments = readLocalComments();

  const supabase = getSupabase();
  if (supabase) {
    const { count, error } = await supabase
      .from("hope_posts")
      .select("*", { count: "exact", head: true });

    if (!error && count && count > 0) {
      localStorage.setItem(LOCAL_SEED_KEY, "1");
      return;
    }
  }

  const needsPosts = local.length < 15;
  const needsComments = localComments.length < 20;

  if (!needsPosts && !needsComments) {
    localStorage.setItem(LOCAL_SEED_KEY, "1");
    return;
  }

  if (needsPosts) {
    const seed = generateSeedHopePosts();
    const existingIds = new Set(local.map((p) => p.id));
    local = sortPosts([...local, ...seed.filter((p) => !existingIds.has(p.id))]);
    writeLocalPostsSafe(local);
  }

  if (needsComments) {
    const commentSeed = generateSeedHopeComments();
    const existingCommentIds = new Set(localComments.map((c) => c.id));
    localComments = [
      ...localComments,
      ...commentSeed.filter((c) => !existingCommentIds.has(c.id)),
    ];
    writeLocalComments(localComments);
  }

  localStorage.setItem(LOCAL_SEED_KEY, "1");
}

/** Deduplicate concurrent seed checks (feed loads posts + comments in parallel). */
export async function seedHopePostsIfEmpty(): Promise<void> {
  if (typeof window === "undefined") return;
  seedHopePostsPromise ??= seedHopePostsIfEmptyInternal().finally(() => {
    seedHopePostsPromise = null;
  });
  await seedHopePostsPromise;
}

const HOPE_POSTS_FULL_SELECT =
  "id, user_id, author_name, author_avatar, job_role, content, likes_count, created_at, edited_at, hope_status, attachments, marketplace_link, marketplace_links, latitude, longitude, location_label";

async function fetchHopePostsFromSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<HopePost[] | null> {
  const full = await supabase
    .from("hope_posts")
    .select(HOPE_POSTS_FULL_SELECT)
    .order("created_at", { ascending: false });

  if (!full.error && full.data) {
    return full.data.map(mapRow);
  }

  if (!isSchemaMismatchError(full.error)) {
    return null;
  }

  const fallback = await supabase
    .from("hope_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (!fallback.error && fallback.data) {
    return fallback.data.map(mapRow);
  }

  return null;
}

/** Synchronous read for instant feed hydration before async Supabase fetch. */
export function readHopePostsFromLocalStorage(): HopePost[] {
  ensureLocalHopeSeedSync();
  const attachmentCache = readAttachmentCache();
  return sortPosts(
    [...readLocalPosts(), ...readPendingPosts()].map((post) =>
      applyAttachmentCacheWith(post, attachmentCache),
    ),
  );
}

async function backfillRemoteAttachments(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  posts: HopePost[],
  remoteById: Map<string, HopePost>,
): Promise<void> {
  for (const post of posts) {
    const remote = remoteById.get(post.id);
    const localCount = resolveHopePostAttachments(post).length;
    const remoteCount = remote ? resolveHopePostAttachments(remote).length : 0;
    if (localCount === 0 || localCount <= remoteCount) continue;

    const persistable = filterPersistableAttachments(resolveHopePostAttachments(post));
    if (persistable.length === 0) continue;

    await tryPersistAttachmentsToSupabase(supabase, post.id, {
      attachments: persistable,
      marketplace_link: post.marketplace_link ?? null,
      marketplace_links: post.marketplace_links ?? [],
    });
  }
}

async function fetchHopePostsForUserFromSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<HopePost[] | null> {
  const full = await supabase
    .from("hope_posts")
    .select(HOPE_POSTS_FULL_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!full.error && full.data) {
    return full.data.map(mapRow);
  }

  if (!isSchemaMismatchError(full.error)) {
    return null;
  }

  const fallback = await supabase
    .from("hope_posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!fallback.error && fallback.data) {
    return fallback.data.map(mapRow);
  }

  return null;
}

export async function fetchHopePosts(): Promise<HopePost[]> {
  ensureLocalHopeSeedSync();

  const supabase = getSupabase();
  const [, remote] = await Promise.all([
    seedHopePostsIfEmpty(),
    supabase ? fetchHopePostsFromSupabase(supabase) : Promise.resolve(null),
  ]);

  // Re-read local after the network round-trip so edits during fetch are not overwritten.
  const local = readLocalPosts();
  const pending = readPendingPosts();
  const remotePosts = remote ?? [];
  const remoteById = new Map(remotePosts.map((post) => [post.id, post]));
  const attachmentCache = readAttachmentCache();

  const merged = mergePosts(remotePosts, [...local, ...pending]).map((post) =>
    applyAttachmentCacheWith(post, attachmentCache),
  );
  const enriched = enrichHopePostsWithMedia(sortPosts(merged)).map((post) => normalizeHopePost(post));

  if (supabase) {
    void backfillRemoteAttachments(supabase, enriched, remoteById);
  }

  for (const post of enriched) {
    clearPendingHopePost(post.id);
  }

  syncLocalPostsCache(enriched);
  return enriched;
}

export async function fetchUserHopePosts(
  userId: string,
  options?: { authorName?: string | null },
): Promise<HopePost[]> {
  ensureLocalHopeSeedSync();

  const supabase = getSupabase();
  const localFiltered = filterPostsForUser(readHopePostsFromLocalStorage(), userId, options?.authorName);

  if (!supabase) {
    return sortPosts(
      enrichHopePostsWithMedia(localFiltered).map((post) => normalizeHopePost(post)),
    );
  }

  const [, remoteUserPosts] = await Promise.all([
    seedHopePostsIfEmpty(),
    fetchHopePostsForUserFromSupabase(supabase, userId),
  ]);

  if (remoteUserPosts) {
    const attachmentCache = readAttachmentCache();
    const merged = mergePosts(remoteUserPosts, localFiltered).map((post) =>
      applyAttachmentCacheWith(post, attachmentCache),
    );
    return sortPosts(enrichHopePostsWithMedia(merged).map((post) => normalizeHopePost(post)));
  }

  const all = await fetchHopePosts();
  const combined = filterPostsForUser(all, userId, options?.authorName);
  return sortPosts(enrichHopePostsWithMedia(combined).map((post) => normalizeHopePost(post)));
}

export async function fetchHopeComments(): Promise<HopeComment[]> {
  await seedHopePostsIfEmpty();

  const local = readLocalComments();
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("hope_comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const remote = data.map(mapCommentRow);
      const map = new Map<string, HopeComment>();
      for (const c of remote) map.set(c.id, c);
      for (const c of local) map.set(c.id, c);
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
  }

  return local.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function createHopeComment(input: {
  post_id: string;
  parent_id: string | null;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  job_role?: string | null;
  content: string;
}): Promise<HopeComment> {
  const id = `local-c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const supabase = getSupabase();

  if (supabase && isUuid(input.user_id)) {
    const { data, error } = await supabase
      .from("hope_comments")
      .insert({
        id,
        post_id: input.post_id,
        parent_id: input.parent_id,
        user_id: input.user_id,
        author_name: input.author_name,
        author_avatar: input.author_avatar,
        job_role: input.job_role ?? null,
        content: input.content,
      })
      .select("*")
      .single();

    if (!error && data) {
      const saved = mapCommentRow(data);
      const local = readLocalComments();
      local.push(saved);
      writeLocalComments(local);
      return saved;
    }
  }

  const comment: HopeComment = {
    id,
    post_id: input.post_id,
    parent_id: input.parent_id,
    user_id: input.user_id,
    author_name: input.author_name,
    author_avatar: input.author_avatar,
    job_role: input.job_role ?? null,
    content: input.content,
    created_at: new Date().toISOString(),
  };

  const comments = readLocalComments();
  comments.push(comment);
  writeLocalComments(comments);
  return comment;
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

function resolveAttachmentsForUpdate(
  input: HopePostAttachment[] | undefined,
  existing: HopePost,
  attachmentsTouched: boolean,
): HopePostAttachment[] {
  const existingResolved = resolveHopePostAttachments(existing);

  if (input === undefined) return existingResolved;

  if (!attachmentsTouched && input.length === 0 && existingResolved.length > 0) {
    return existingResolved;
  }

  const persistableInput = filterPersistableAttachments(input);
  if (persistableInput.length > 0) return input;

  if (input.length === 0) return [];

  if (existingResolved.length > 0) return existingResolved;

  return input;
}

async function tryPersistAttachmentsToSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  postId: string,
  payload: {
    attachments: HopePostAttachment[];
    marketplace_link: string | null;
    marketplace_links: string[];
  },
): Promise<boolean> {
  const persistable = filterPersistableAttachments(payload.attachments);
  if (persistable.length === 0) return false;

  const { error } = await supabase
    .from("hope_posts")
    .update({
      attachments: persistable,
      marketplace_link: payload.marketplace_link,
      marketplace_links: payload.marketplace_links,
    })
    .eq("id", postId);

  return !error;
}

function buildSavedHopePost(
  row: Record<string, unknown>,
  attachments: HopePostAttachment[],
  marketplace_link: string | null,
  marketplace_links: string[],
  edited_at?: string | null,
): HopePost {
  const mapped = mapRow(row);
  const mergedAttachments =
    mergeAttachmentLists(attachments, mapped.attachments) ??
    (attachments.length > 0 ? attachments : mapped.attachments);
  const saved = withDerivedImageUrls({
    ...mapped,
    attachments: mergedAttachments,
    marketplace_link,
    marketplace_links: marketplace_links.length > 0 ? marketplace_links : undefined,
    edited_at: edited_at ?? mapped.edited_at,
  });
  if (saved.attachments?.length) {
    cachePostAttachments(saved.id, saved.attachments);
  }
  return saved;
}
function buildLocalHopePost(input: {
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  job_role?: string | null;
  content: string;
  attachments: HopePostAttachment[];
  marketplace_link: string | null;
  marketplace_links: string[];
}): HopePost {
  return withDerivedImageUrls({
    id: `local-${Date.now()}`,
    user_id: input.user_id,
    author_name: input.author_name,
    author_avatar: input.author_avatar,
    job_role: input.job_role ?? null,
    content: input.content,
    likes_count: 0,
    created_at: new Date().toISOString(),
    attachments: input.attachments.length > 0 ? input.attachments : undefined,
    marketplace_link: input.marketplace_link,
    marketplace_links: input.marketplace_links,
  });
}

export async function createHopePost(input: {
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  job_role?: string | null;
  content: string;
  attachments?: HopePostAttachment[];
  marketplace_link?: string | null;
  marketplace_links?: string[];
}): Promise<HopePost> {
  const attachments = input.attachments ?? [];
  const persistableAttachments = filterPersistableAttachments(attachments);
  const { marketplace_link, marketplace_links } = resolveMarketplaceFields(input);

  const optimistic = withDerivedImageUrls(
    buildLocalHopePost({
      user_id: input.user_id,
      author_name: input.author_name,
      author_avatar: input.author_avatar,
      job_role: input.job_role ?? null,
      content: input.content,
      attachments,
      marketplace_link,
      marketplace_links,
    }),
  );
  stagePendingHopePost(optimistic);

  const supabase = getSupabase();

  if (supabase && isUuid(input.user_id)) {
    const baseRow = {
      user_id: input.user_id,
      author_name: input.author_name,
      author_avatar: input.author_avatar,
      job_role: input.job_role ?? null,
      content: input.content,
      likes_count: 0,
    };

    const fullInsert = await supabase
      .from("hope_posts")
      .insert({
        ...baseRow,
        attachments: persistableAttachments,
        marketplace_link,
        marketplace_links,
      })
      .select("*")
      .single();

    if (!fullInsert.error && fullInsert.data) {
      const saved = buildSavedHopePost(
        fullInsert.data,
        attachments,
        marketplace_link,
        marketplace_links,
      );
      clearPendingHopePost(optimistic.id);
      persistLocalPost(saved);
      return saved;
    }

    if (isSchemaMismatchError(fullInsert.error)) {
      const minimalInsert = await supabase.from("hope_posts").insert(baseRow).select("*").single();

      if (!minimalInsert.error && minimalInsert.data) {
        const postId = String(minimalInsert.data.id);
        await tryPersistAttachmentsToSupabase(supabase, String(minimalInsert.data.id), {
          attachments: persistableAttachments,
          marketplace_link,
          marketplace_links,
        });

        const saved = buildSavedHopePost(
          minimalInsert.data,
          attachments,
          marketplace_link,
          marketplace_links,
        );
        clearPendingHopePost(optimistic.id);
        persistLocalPost(saved);
        return saved;
      }
    }
  }

  clearPendingHopePost(optimistic.id);
  persistLocalPost(optimistic);
  return optimistic;
}

export async function updateHopePost(
  postId: string,
  userId: string,
  input: {
    content: string;
    attachments?: HopePostAttachment[];
    marketplace_link?: string | null;
    marketplace_links?: string[];
    attachmentsTouched?: boolean;
    existingPost?: HopePost;
  },
): Promise<HopePost> {
  const { marketplace_link, marketplace_links } = resolveMarketplaceFields(input);
  const edited_at = new Date().toISOString();

  const existing =
    input.existingPost ??
    readLocalPosts().find((entry) => entry.id === postId) ??
    ({
      id: postId,
      user_id: userId,
      author_name: "",
      author_avatar: null,
      job_role: null,
      content: input.content,
      likes_count: 0,
      created_at: edited_at,
    } satisfies HopePost);

  if (existing.user_id !== userId) {
    throw new Error("You can only edit your own posts.");
  }

  const attachments = resolveAttachmentsForUpdate(
    input.attachments,
    existing,
    input.attachmentsTouched ?? true,
  );
  const persistableAttachments = filterPersistableAttachments(attachments);

  const optimistic = withDerivedImageUrls({
    ...existing,
    content: input.content,
    attachments: attachments.length > 0 ? attachments : undefined,
    marketplace_link,
    marketplace_links,
    edited_at,
  });
  if (optimistic.attachments?.length) {
    cachePostAttachments(postId, optimistic.attachments);
  }
  stagePendingHopePost(optimistic);
  replaceLocalPost(optimistic);

  const supabase = getSupabase();

  if (supabase && isUuid(userId) && isUuid(postId)) {
    const updatePayload: Record<string, unknown> = {
      content: input.content,
      marketplace_link,
      marketplace_links,
      edited_at,
    };
    if (persistableAttachments.length > 0) {
      updatePayload.attachments = persistableAttachments;
    } else if (input.attachmentsTouched && attachments.length === 0) {
      updatePayload.attachments = [];
    }

    const fullUpdate = await supabase
      .from("hope_posts")
      .update(updatePayload)
      .eq("id", postId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (!fullUpdate.error && fullUpdate.data) {
      if (persistableAttachments.length > 0) {
        cachePostAttachments(postId, persistableAttachments);
      }
      const saved = buildSavedHopePost(
        fullUpdate.data,
        attachments,
        marketplace_link,
        marketplace_links,
        edited_at,
      );
      clearPendingHopePost(postId);
      replaceLocalPost(saved);
      return saved;
    }

    if (isSchemaMismatchError(fullUpdate.error)) {
      const minimalUpdate = await supabase
        .from("hope_posts")
        .update({ content: input.content, edited_at })
        .eq("id", postId)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (!minimalUpdate.error && minimalUpdate.data) {
        if (persistableAttachments.length > 0) {
          await tryPersistAttachmentsToSupabase(supabase, postId, {
            attachments: persistableAttachments,
            marketplace_link,
            marketplace_links,
          });
          cachePostAttachments(postId, persistableAttachments);
        }

        const saved = buildSavedHopePost(
          minimalUpdate.data,
          attachments,
          marketplace_link,
          marketplace_links,
          edited_at,
        );
        clearPendingHopePost(postId);
        replaceLocalPost(saved);
        return saved;
      }
    }
  }

  clearPendingHopePost(postId);
  return optimistic;
}

export async function deleteHopePost(postId: string, userId: string): Promise<void> {
  const existing = readLocalPosts().find((entry) => entry.id === postId);
  if (existing && existing.user_id !== userId) {
    throw new Error("You can only delete your own posts.");
  }

  const supabase = getSupabase();
  if (supabase && isUuid(userId) && isUuid(postId)) {
    await supabase.from("hope_posts").delete().eq("id", postId).eq("user_id", userId);
  }

  deleteLocalPost(postId);
  clearPendingHopePost(postId);
}

export function getStorageMode(): "supabase" | "local" {
  return isSupabaseConfigured ? "supabase" : "local";
}
