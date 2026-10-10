export type ProfileAvatarMediaType = "image" | "gif" | "video";

export interface ProfileAvatarCrop {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Static PNG fallback when avatarImageUrl is a looping video. */
  posterUrl?: string | null;
}

export interface ProfileAvatarMedia {
  avatarImageUrl: string;
  avatarMediaType: ProfileAvatarMediaType;
  avatarCrop: ProfileAvatarCrop | null;
}

export const MAX_PROFILE_VIDEO_SECONDS = 10;
export const MAX_PROFILE_AVATAR_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PROFILE_AVATAR_VIDEO_BYTES = 20 * 1024 * 1024;

export const PROFILE_AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime";

export function classifyProfileAvatarFile(file: File): ProfileAvatarMediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("image/")) return "image";
  const lower = file.name.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(lower)) return "video";
  if (/\.gif$/.test(lower)) return "gif";
  if (/\.(jpe?g|png|webp|avif)$/.test(lower)) return "image";
  return null;
}

export function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read video metadata."));
    };
    video.src = objectUrl;
  });
}

export async function validateProfileAvatarFile(file: File): Promise<ProfileAvatarMediaType> {
  const mediaType = classifyProfileAvatarFile(file);
  if (!mediaType) {
    throw new Error("Use a JPG, PNG, WebP, GIF, or MP4/WebM video under 10 seconds.");
  }

  if (mediaType === "video") {
    if (file.size > MAX_PROFILE_AVATAR_VIDEO_BYTES) {
      throw new Error("Video must be 20 MB or smaller.");
    }
    const duration = await getVideoDurationSeconds(file);
    if (!Number.isFinite(duration) || duration > MAX_PROFILE_VIDEO_SECONDS) {
      throw new Error(`Video must be ${MAX_PROFILE_VIDEO_SECONDS} seconds or shorter.`);
    }
    return mediaType;
  }

  if (file.size > MAX_PROFILE_AVATAR_IMAGE_BYTES) {
    throw new Error("Image must be 8 MB or smaller.");
  }

  return mediaType;
}

export function defaultAvatarCrop(): ProfileAvatarCrop {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

export function isDefaultAvatarCrop(crop: ProfileAvatarCrop): boolean {
  return crop.scale === 1 && crop.offsetX === 0 && crop.offsetY === 0;
}

export function fitScaleForViewport(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
): number {
  if (!naturalWidth || !naturalHeight) return 1;
  return Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
}

export async function renderCroppedAvatarBlob(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  crop: ProfileAvatarCrop,
  viewportSize = 280,
  outputSize = 512,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare avatar canvas.");

  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.clip();

  const fitScale = fitScaleForViewport(naturalWidth, naturalHeight, viewportSize);
  const scale = fitScale * crop.scale;
  const drawW = naturalWidth * scale;
  const drawH = naturalHeight * scale;
  const ratio = outputSize / viewportSize;
  const cx = outputSize / 2 + crop.offsetX * ratio;
  const cy = outputSize / 2 + crop.offsetY * ratio;

  ctx.drawImage(source, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export avatar image."))),
      "image/png",
      0.92,
    );
  });
}

export function captureVideoFrame(
  video: HTMLVideoElement,
): { source: CanvasImageSource; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture video frame.");
  ctx.drawImage(video, 0, 0);
  return { source: canvas, width: canvas.width, height: canvas.height };
}
