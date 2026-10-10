import { classifyHopeAttachment } from "@/lib/hope-attachment-utils";
import {
  uploadHopePostAttachmentServer,
} from "@/lib/hope-post-attachments.server";
import {
  ensurePostAttachmentsBucket,
  getPostAttachmentsBucketName,
  parseStorageUploadError,
  resetPostAttachmentsBucketCache,
  StorageBucketSetupError,
} from "@/lib/supabase-storage-bucket";
import { getSupabase } from "@/lib/supabase";
import type { HopePostAttachment } from "@/types/hope-post";

export const POST_ATTACHMENTS_BUCKET = getPostAttachmentsBucketName();

const UPLOAD_TIMEOUT_MS = 60_000;
/** Concurrent uploads per batch — avoids memory spikes on large multi-file posts. */
const UPLOAD_CONCURRENCY = 4;
/** When Storage is unavailable, embed small files inline (works with local + Supabase JSONB). */
export const MAX_INLINE_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)),
        ms,
      );
    }),
  ]);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function uploadInlineAttachment(file: File): Promise<HopePostAttachment> {
  const url = await fileToDataUrl(file);
  return {
    url,
    file_type: classifyHopeAttachment(file),
    file_name: file.name,
  };
}

function isServerAdminMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SERVICE_ROLE_KEY") || message.includes("admin client unavailable");
}

async function uploadViaServer(file: File, userId: string): Promise<HopePostAttachment | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const base64 = await fileToBase64(file);
    return await uploadHopePostAttachmentServer({
      data: {
        accessToken: session.access_token,
        userId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
      },
    });
  } catch (error) {
    if (isServerAdminMissingError(error)) return null;
    throw error;
  }
}

async function uploadViaClientStorage(file: File, userId: string): Promise<HopePostAttachment> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase storage is not configured.");
  }

  const bucketName = await ensurePostAttachmentsBucket(supabase);
  const safeName = sanitizeFileName(file.name);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const uploadPromise = supabase.storage.from(bucketName).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  const { data, error } = await withTimeout(uploadPromise, UPLOAD_TIMEOUT_MS, "Upload");

  if (error) {
    const parsed = parseStorageUploadError(error);
    if (parsed.isBucketError) {
      resetPostAttachmentsBucketCache();
      throw new StorageBucketSetupError(bucketName, parsed.message);
    }
    throw new Error(parsed.message);
  }

  const { data: publicUrl } = supabase.storage.from(bucketName).getPublicUrl(data.path);

  return {
    url: publicUrl.publicUrl,
    file_type: classifyHopeAttachment(file),
    file_name: file.name,
  };
}

export async function uploadHopePostAttachment(
  file: File,
  userId: string,
): Promise<HopePostAttachment> {
  try {
    const fromServer = await uploadViaServer(file, userId);
    if (fromServer) return fromServer;

    return await uploadViaClientStorage(file, userId);
  } catch (error) {
    const parsed = parseStorageUploadError(error);
    const storageUnavailable = parsed.isBucketError || isStorageBucketSetupError(error);

    if (storageUnavailable && file.size <= MAX_INLINE_ATTACHMENT_BYTES) {
      return uploadInlineAttachment(file);
    }

    if (storageUnavailable && file.size > MAX_INLINE_ATTACHMENT_BYTES) {
      throw new StorageBucketSetupError(
        getPostAttachmentsBucketName(),
        `File is too large for inline upload (${Math.round(file.size / (1024 * 1024))} MB). Add SUPABASE_SERVICE_ROLE_KEY to .env.local or create the post-attachments bucket in Supabase.`,
      );
    }

    throw error instanceof Error ? error : new Error(parsed.message);
  }
}

function isStorageBucketSetupError(error: unknown): boolean {
  return error instanceof StorageBucketSetupError;
}

export async function uploadHopePostAttachments(
  files: File[],
  userId: string,
): Promise<HopePostAttachment[]> {
  const results: HopePostAttachment[] = [];

  for (let index = 0; index < files.length; index += UPLOAD_CONCURRENCY) {
    const batch = files.slice(index, index + UPLOAD_CONCURRENCY);
    const uploaded = await Promise.all(
      batch.map((file) => uploadHopePostAttachment(file, userId)),
    );
    results.push(...uploaded);
  }

  return results;
}

export { resetPostAttachmentsBucketCache };
