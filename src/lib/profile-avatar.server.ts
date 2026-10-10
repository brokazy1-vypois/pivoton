import { createServerFn } from "@tanstack/react-start";
import { getPostAttachmentsBucketName } from "@/lib/supabase-storage-bucket";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase-admin.server";

const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "model/gltf-binary",
];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function ensureBucketAdmin(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<string> {
  const bucketId = getPostAttachmentsBucketName();
  const { data } = await admin.storage.getBucket(bucketId);

  if (!data) {
    const { error } = await admin.storage.createBucket(bucketId, {
      public: true,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: ALLOWED_AVATAR_MIME_TYPES,
    });

    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(error.message);
    }
  }

  return bucketId;
}

interface UploadPayload {
  accessToken: string;
  userId: string;
  fileName: string;
  mimeType: string;
  base64: string;
}

function extractUploadPayload(ctx: unknown): UploadPayload {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const accessToken = typeof record.accessToken === "string" ? record.accessToken : "";
      const userId = typeof record.userId === "string" ? record.userId : "";
      const fileName = typeof record.fileName === "string" ? record.fileName : "avatar.png";
      const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/png";
      const base64 = typeof record.base64 === "string" ? record.base64 : "";
      if (accessToken && userId && base64) {
        return { accessToken, userId, fileName, mimeType, base64 };
      }
    }
  }
  throw new Error("Invalid avatar upload payload.");
}

export const provisionProfileAvatarStorageServer = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; bucket: string }> => {
    if (!isSupabaseAdminConfigured()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase admin client unavailable.");

    const bucket = await ensureBucketAdmin(admin);
    return { ok: true, bucket };
  },
);

export const uploadProfileAvatarServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ url: string; path: string }> => {
    if (!isSupabaseAdminConfigured()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase admin client unavailable.");

    const { accessToken, userId, fileName, mimeType, base64 } = extractUploadPayload(ctx);

    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user || authData.user.id !== userId) {
      throw new Error("Unauthorized avatar upload request.");
    }

    const bucket = await ensureBucketAdmin(admin);
    const safeName = sanitizeFileName(fileName);
    const path = `${userId}/profile-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

    const { data, error } = await admin.storage.from(bucket).upload(path, binary, {
      cacheControl: "3600",
      upsert: false,
      contentType: mimeType,
    });

    if (error) throw new Error(error.message);

    const { data: publicUrl } = admin.storage.from(bucket).getPublicUrl(data.path);
    return { url: publicUrl.publicUrl, path: data.path };
  },
);
