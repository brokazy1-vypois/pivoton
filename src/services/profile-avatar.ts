import {
  ensurePostAttachmentsBucket,
  getPostAttachmentsBucketName,
  isStorageBucketError,
  parseStorageUploadError,
  resetPostAttachmentsBucketCache,
  STORAGE_BUCKET_SETUP_HINT,
  StorageBucketSetupError,
} from "@/lib/supabase-storage-bucket";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { uploadProfileAvatarServer } from "@/lib/profile-avatar.server";
import type { AvaturnExportResult } from "@/lib/avaturn-env";
import type { ProfileAvatarCrop, ProfileAvatarMedia, ProfileAvatarMediaType } from "@/lib/profile-avatar-media";
import { fileToBase64, fileToDataUrl } from "@/services/hope-post-attachments";

const LOCAL_AVATAR_MEDIA_KEY = "pivoton-profile-avatar-media";
const UPLOAD_TIMEOUT_MS = 60_000;

export function readProfileAvatarMediaCache(): Record<string, ProfileAvatarMedia> {
  return readLocalAvatarMedia();
}

export function writeProfileAvatarMediaCacheEntry(
  userId: string,
  media: ProfileAvatarMedia,
): ProfileAvatarMedia {
  const local = readLocalAvatarMedia();
  local[userId] = media;
  writeLocalAvatarMedia(local);
  return media;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function readLocalAvatarMedia(): Record<string, ProfileAvatarMedia> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_AVATAR_MEDIA_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProfileAvatarMedia>) : {};
  } catch {
    return {};
  }
}

function writeLocalAvatarMedia(map: Record<string, ProfileAvatarMedia>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_AVATAR_MEDIA_KEY, JSON.stringify(map));
}

function parseCrop(value: unknown): ProfileAvatarCrop | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const scale = Number(row.scale);
  const offsetX = Number(row.offsetX);
  const offsetY = Number(row.offsetY);
  if (!Number.isFinite(scale) || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
    return null;
  }
  const posterUrl = typeof row.posterUrl === "string" ? row.posterUrl : null;
  return { scale, offsetX, offsetY, posterUrl };
}

function parseMediaType(value: unknown): ProfileAvatarMediaType | null {
  if (value === "image" || value === "gif" || value === "video") return value;
  return null;
}

function isServerAdminMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SERVICE_ROLE_KEY") || message.includes("admin client unavailable");
}

function bucketSetupMessage(): string {
  return `Storage bucket "${getPostAttachmentsBucketName()}" is missing. Run supabase/migrations/017_profile_avatar_storage.sql in the Supabase SQL Editor.\n${STORAGE_BUCKET_SETUP_HINT}`;
}

export async function fetchUserProfileAvatarMedia(
  userId: string,
): Promise<ProfileAvatarMedia | null> {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("avatar_image_url, avatar_media_type, avatar_crop")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data?.avatar_image_url) {
      const media: ProfileAvatarMedia = {
        avatarImageUrl: String(data.avatar_image_url),
        avatarMediaType: parseMediaType(data.avatar_media_type) ?? "image",
        avatarCrop: parseCrop(data.avatar_crop),
      };
      writeLocalAvatarMedia({ ...readLocalAvatarMedia(), [userId]: media });
      return media;
    }
  }

  return readLocalAvatarMedia()[userId] ?? null;
}

async function uploadViaServer(file: File, userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const base64 = await fileToBase64(file);
    const result = await uploadProfileAvatarServer({
      data: {
        accessToken: session.access_token,
        userId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
      },
    });
    return result.url;
  } catch (error) {
    if (isServerAdminMissingError(error)) return null;
    throw error;
  }
}

async function uploadViaClientStorage(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    return fileToDataUrl(file);
  }

  const bucketName = await ensurePostAttachmentsBucket(supabase);
  const safeName = sanitizeFileName(file.name);
  const path = `${userId}/profile-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const uploadPromise = supabase.storage.from(bucketName).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Avatar upload timed out.")), UPLOAD_TIMEOUT_MS);
  });

  const { data, error } = await Promise.race([uploadPromise, timeout]);

  if (error) {
    const parsed = parseStorageUploadError(error);
    if (parsed.isBucketError) {
      resetPostAttachmentsBucketCache();
      throw new StorageBucketSetupError(bucketName, bucketSetupMessage());
    }
    if (parsed.isPolicyError) {
      throw new Error(
        "Storage policy denied this upload. Run supabase/migrations/017_profile_avatar_storage.sql in Supabase, then sign out and back in.",
      );
    }
    throw new Error(parsed.message);
  }

  const { data: publicUrl } = supabase.storage.from(bucketName).getPublicUrl(data.path);
  return publicUrl.publicUrl;
}

async function uploadAvatarFile(userId: string, file: File): Promise<string> {
  try {
    const fromServer = await uploadViaServer(file, userId);
    if (fromServer) return fromServer;

    return await uploadViaClientStorage(file, userId);
  } catch (error) {
    if (error instanceof StorageBucketSetupError || isStorageBucketError(error)) {
      console.warn("[Avatar] Storage bucket unavailable — using inline image fallback.", error);
      return fileToDataUrl(file);
    }
    throw error instanceof Error ? error : new Error("Avatar upload failed.");
  }
}

async function uploadAvaturnGlbFile(userId: string, file: File): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    return URL.createObjectURL(file);
  }

  try {
    const bucketName = await ensurePostAttachmentsBucket(supabase);
    const safeName = sanitizeFileName(file.name);
    const path = `${userId}/avaturn-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const uploadPromise = supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "model/gltf-binary",
    });

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Avatar upload timed out.")), UPLOAD_TIMEOUT_MS);
    });

    const { data, error } = await Promise.race([uploadPromise, timeout]);

    if (error) {
      const parsed = parseStorageUploadError(error);
      if (parsed.isBucketError) {
        resetPostAttachmentsBucketCache();
        throw new StorageBucketSetupError(bucketName, bucketSetupMessage());
      }
      if (parsed.isPolicyError) {
        throw new Error(
          "Storage policy denied this upload. Run supabase/migrations/017_profile_avatar_storage.sql in Supabase, then sign out and back in.",
        );
      }
      throw new Error(parsed.message);
    }

    const { data: publicUrl } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return publicUrl.publicUrl;
  } catch (error) {
    if (error instanceof StorageBucketSetupError || isStorageBucketError(error)) {
      console.warn("[Avatar] GLB storage unavailable — using session-local URL fallback.", error);
      return URL.createObjectURL(file);
    }
    throw error instanceof Error ? error : new Error("Avatar upload failed.");
  }
}

/** Persist Avaturn GLB export to Supabase Storage when needed, return storable URL. */
export async function resolveAvaturnGlbStorageUrl(
  exportResult: AvaturnExportResult,
  userId: string,
): Promise<string> {
  if (exportResult.urlType === "httpURL" && exportResult.url.startsWith("http")) {
    return exportResult.url;
  }

  const response = await fetch(exportResult.url);
  if (!response.ok) {
    throw new Error("Could not read exported avatar model.");
  }

  const blob = await response.blob();
  const file = new File([blob], `avaturn-${exportResult.avatarId ?? Date.now()}.glb`, {
    type: blob.type || "model/gltf-binary",
  });

  try {
    const fromServer = await uploadViaServer(file, userId);
    if (fromServer) return fromServer;
  } catch (error) {
    if (!isServerAdminMissingError(error)) throw error;
  }

  try {
    return await uploadAvaturnGlbFile(userId, file);
  } catch (error) {
    console.warn("[Avatar] Could not persist GLB to storage.", error);
    return URL.createObjectURL(file);
  }
}

export async function saveUserProfileAvatarMedia(input: {
  userId: string;
  fullName?: string;
  avatar?: string;
  file: File;
  mediaType: ProfileAvatarMediaType;
  crop: ProfileAvatarCrop | null;
}): Promise<ProfileAvatarMedia> {
  const avatarImageUrl = await uploadAvatarFile(input.userId, input.file);
  const media: ProfileAvatarMedia = {
    avatarImageUrl,
    avatarMediaType: input.mediaType,
    avatarCrop: input.crop,
  };

  const local = readLocalAvatarMedia();
  local[input.userId] = media;
  writeLocalAvatarMedia(local);

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return media;

  const payload: Record<string, unknown> = {
    user_id: input.userId,
    avatar_image_url: avatarImageUrl,
    avatar_media_type: input.mediaType,
    avatar_crop: input.crop,
    updated_at: new Date().toISOString(),
  };
  if (input.fullName) payload.full_name = input.fullName;
  if (input.avatar) payload.avatar = input.avatar;

  const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("[Avatar] Could not sync avatar media to user_profiles.", error.message);
  }

  return media;
}
