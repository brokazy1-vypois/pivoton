import type { HopeAttachmentFileType, HopePostAttachment } from "@/types/hope-post";

export const HOPE_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.pdf,.docx,.txt,.zip";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm"]);
const DOC_EXT = new Set(["pdf", "docx", "txt", "zip"]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024;

function extension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}

export function classifyHopeAttachment(file: File): HopeAttachmentFileType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";

  const ext = extension(file.name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "document";
}

export function maxBytesForFileType(type: HopeAttachmentFileType): number {
  if (type === "image") return MAX_IMAGE_BYTES;
  if (type === "video") return MAX_VIDEO_BYTES;
  return MAX_DOC_BYTES;
}

export function validateHopeAttachmentFile(
  file: File,
): { ok: true } | { ok: false; message: string } {
  const fileType = classifyHopeAttachment(file);
  const maxBytes = maxBytesForFileType(fileType);
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, message: `${file.name} exceeds the ${limitMb} MB limit.` };
  }

  const ext = extension(file.name);
  const allowed =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "text/plain" ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    IMAGE_EXT.has(ext) ||
    VIDEO_EXT.has(ext) ||
    DOC_EXT.has(ext);

  if (!allowed) {
    return { ok: false, message: `${file.name} is not a supported attachment type.` };
  }

  return { ok: true };
}

export function parseHopeAttachments(raw: unknown): HopePostAttachment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : null;
      const file_name = typeof record.file_name === "string" ? record.file_name : "file";
      const file_type = record.file_type;
      if (!url) return null;
      if (file_type !== "image" && file_type !== "video" && file_type !== "document") return null;
      return { url, file_name, file_type };
    })
    .filter((item): item is HopePostAttachment => Boolean(item));
}

export function imageUrlsFromAttachments(attachments: HopePostAttachment[]): string[] {
  return attachments
    .filter((a) => a.file_type === "image" && isLoadableAttachmentUrl(a.url))
    .map((a) => a.url);
}

const INLINE_ATTACHMENT_URL_PREFIX = "inline://";

export function isInlinePlaceholderUrl(url: string): boolean {
  return url.startsWith(INLINE_ATTACHMENT_URL_PREFIX);
}

/** URLs that can render in `<img src>` / video players. */
export function isLoadableAttachmentUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

/** URLs safe to persist in Supabase JSONB (remote storage or inline fallback). */
export function isPersistableAttachmentUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  );
}

export function attachmentsFromImageUrls(imageUrls: string[]): HopePostAttachment[] {
  return imageUrls.filter(isLoadableAttachmentUrl).map((url, index) => ({
    url,
    file_type: "image" as const,
    file_name: `image-${index + 1}.jpg`,
  }));
}

/** Best-effort attachment list for display, edit init, and save fallbacks. */
export function resolveHopePostAttachments(post: {
  attachments?: HopePostAttachment[];
  image_urls?: string[];
}): HopePostAttachment[] {
  const fromAttachments = (post.attachments ?? []).filter(
    (attachment) => isLoadableAttachmentUrl(attachment.url) && !isInlinePlaceholderUrl(attachment.url),
  );
  if (fromAttachments.length > 0) return fromAttachments;

  const fromLegacyUrls = attachmentsFromImageUrls(post.image_urls ?? []);
  if (fromLegacyUrls.length > 0) return fromLegacyUrls;

  return [];
}

export function filterPersistableAttachments(attachments: HopePostAttachment[]): HopePostAttachment[] {
  return attachments.filter((attachment) => isPersistableAttachmentUrl(attachment.url));
}
