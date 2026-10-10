import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "post-attachments";
const BUCKET_SETUP_SQL_PATH = "supabase/migrations/008_hope_posts_attachments.sql";

function readBucketEnv(name: string, viteName: string): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  return meta[name]?.trim() || meta[viteName]?.trim() || "";
}

/** Primary bucket for hope post attachments (override via env). */
export function getPostAttachmentsBucketName(): string {
  return (
    readBucketEnv("NEXT_PUBLIC_SUPABASE_POST_ATTACHMENTS_BUCKET", "VITE_SUPABASE_POST_ATTACHMENTS_BUCKET") ||
    DEFAULT_BUCKET
  );
}

/** Optional fallback bucket if the primary bucket is missing. */
export function getPostAttachmentsFallbackBucketName(): string | null {
  const value = readBucketEnv(
    "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
    "VITE_SUPABASE_STORAGE_BUCKET",
  );
  return value || null;
}

export class StorageBucketSetupError extends Error {
  readonly bucketName: string;
  readonly isBucketSetupError = true;

  constructor(bucketName: string, cause?: string) {
    super(
      cause ??
        `Storage bucket "${bucketName}" was not found. Run the SQL in ${BUCKET_SETUP_SQL_PATH} in the Supabase Dashboard (SQL Editor), or create a public bucket named "${bucketName}" under Storage.`,
    );
    this.name = "StorageBucketSetupError";
    this.bucketName = bucketName;
  }
}

let cachedBucketName: string | null = null;
let bucketEnsurePromise: Promise<string> | null = null;

export function resetPostAttachmentsBucketCache(): void {
  cachedBucketName = null;
  bucketEnsurePromise = null;
}

export function isBucketNotFoundMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("bucket not found") ||
    lower.includes("does not exist") ||
    lower.includes("not found")
  );
}

export function isStorageBucketError(error: unknown): error is StorageBucketSetupError {
  return error instanceof StorageBucketSetupError || Boolean(
    error &&
      typeof error === "object" &&
      "isBucketSetupError" in error &&
      (error as StorageBucketSetupError).isBucketSetupError,
  );
}

export function parseStorageUploadError(error: unknown): {
  message: string;
  isBucketError: boolean;
  isPolicyError: boolean;
} {
  if (isStorageBucketError(error)) {
    return { message: error.message, isBucketError: true, isPolicyError: false };
  }

  const record = error as { message?: string; statusCode?: string | number; error?: string };
  const message = record?.message ?? record?.error ?? "Upload failed";
  const status = record?.statusCode;
  const is404 = status === 404 || status === "404";
  const isBucketError = is404 || isBucketNotFoundMessage(message);
  const isPolicyError =
    status === 403 ||
    status === "403" ||
    message.toLowerCase().includes("policy") ||
    message.toLowerCase().includes("row-level security") ||
    message.toLowerCase().includes("not authorized");

  return { message, isBucketError, isPolicyError };
}

async function bucketExists(supabase: SupabaseClient, bucketId: string): Promise<boolean> {
  const { data, error } = await supabase.storage.getBucket(bucketId);
  if (data) return true;
  if (error && isBucketNotFoundMessage(error.message ?? "")) return false;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError && buckets?.some((b) => b.id === bucketId || b.name === bucketId)) {
    return true;
  }

  return false;
}

async function tryCreateBucket(supabase: SupabaseClient, bucketId: string): Promise<boolean> {
  const { error } = await supabase.storage.createBucket(bucketId, {
    public: true,
    fileSizeLimit: 52_428_800,
  });
  return !error;
}

/**
 * Resolves the active post-attachments bucket: env override → existence check →
 * auto-create attempt → optional fallback bucket from env.
 */
export async function ensurePostAttachmentsBucket(supabase: SupabaseClient): Promise<string> {
  if (cachedBucketName) return cachedBucketName;
  if (bucketEnsurePromise) return bucketEnsurePromise;

  bucketEnsurePromise = (async () => {
    const primary = getPostAttachmentsBucketName();
    const fallback = getPostAttachmentsFallbackBucketName();
    const candidates = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];

    for (const bucketId of candidates) {
      if (await bucketExists(supabase, bucketId)) {
        cachedBucketName = bucketId;
        return bucketId;
      }
    }

    if (await tryCreateBucket(supabase, primary)) {
      cachedBucketName = primary;
      return primary;
    }

    if (fallback && (await bucketExists(supabase, fallback))) {
      cachedBucketName = fallback;
      return fallback;
    }

    resetPostAttachmentsBucketCache();
    throw new StorageBucketSetupError(primary);
  })();

  try {
    return await bucketEnsurePromise;
  } catch (error) {
    resetPostAttachmentsBucketCache();
    throw error;
  }
}

export const STORAGE_BUCKET_SETUP_HINT = [
  "Supabase Dashboard → SQL Editor → run supabase/migrations/008_hope_posts_attachments.sql",
  "Or Storage → New bucket → name: post-attachments → Public bucket: ON",
  "Then add RLS policies from the migration file for authenticated uploads.",
].join("\n");
