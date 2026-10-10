import { useRef, useState } from "react";
import { Box, Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarMediaCropper } from "@/components/profile/AvatarMediaCropper";
import { AvaturnAvatarModal } from "@/components/profile/AvaturnAvatarModal";
import { ProfileAvatarDisplay } from "@/components/profile/ProfileAvatarDisplay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PROFILE_AVATAR_ACCEPT,
  renderCroppedAvatarBlob,
  validateProfileAvatarFile,
  type ProfileAvatarCrop,
  type ProfileAvatarMedia,
  type ProfileAvatarMediaType,
} from "@/lib/profile-avatar-media";
import { provisionProfileAvatarStorageServer } from "@/lib/profile-avatar.server";
import { saveUserProfileAvatarMedia, resolveAvaturnGlbStorageUrl } from "@/services/profile-avatar";
import { upsertUserAvatarGlb } from "@/services/user-map-profiles";
import { renderGlbAnimatedAvatar } from "@/lib/avaturn-animated-avatar";
import { defaultAvatarCrop } from "@/lib/profile-avatar-media";
import { useProfileAvatar } from "@/context/ProfileAvatarContext";
import type { AvaturnExportResult } from "@/lib/avaturn-env";

interface ProfileAvatarEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  avatar: string;
  avatarGlbUrl?: string | null;
  avatarMedia?: ProfileAvatarMedia | null;
  onSaved?: (avatarGlbUrl: string) => void;
  onMediaSaved?: (media: ProfileAvatarMedia) => void;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image."));
    };
    image.src = objectUrl;
  });
}

export function ProfileAvatarEditModal({
  open,
  onOpenChange,
  userId,
  fullName,
  avatar,
  avatarGlbUrl,
  avatarMedia,
  onSaved,
  onMediaSaved,
}: ProfileAvatarEditModalProps) {
  const { getAvatarMedia, publishAvatarMedia } = useProfileAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avaturnOpen, setAvaturnOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMediaType, setPendingMediaType] = useState<ProfileAvatarMediaType | null>(null);
  const [saving, setSaving] = useState(false);

  const displayedMedia = getAvatarMedia(userId) ?? avatarMedia;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const mediaType = await validateProfileAvatarFile(file);
      setPendingFile(file);
      setPendingMediaType(mediaType);
      setCropOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not use that file.");
    }
  };

  const handleCropConfirm = async (crop: ProfileAvatarCrop) => {
    if (!pendingFile || !pendingMediaType) return;

    setSaving(true);
    try {
      let uploadFile = pendingFile;
      let mediaType = pendingMediaType;
      let savedCrop: ProfileAvatarCrop | null = crop;

      if (pendingMediaType === "image") {
        const image = await loadImageFromFile(pendingFile);
        const blob = await renderCroppedAvatarBlob(
          image,
          image.naturalWidth,
          image.naturalHeight,
          crop,
        );
        uploadFile = new File([blob], "avatar.png", { type: "image/png" });
        savedCrop = null;
        mediaType = "image";
      }

      const media = await saveUserProfileAvatarMedia({
        userId,
        fullName,
        avatar,
        file: uploadFile,
        mediaType,
        crop: savedCrop,
      });

      onMediaSaved?.(media);
      publishAvatarMedia(userId, media);
      setCropOpen(false);
      setPendingFile(null);
      setPendingMediaType(null);
      toast.success("Profile avatar updated.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save avatar.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvaturnExport = async (exportResult: AvaturnExportResult) => {
    setAvaturnOpen(false);
    setSaving(true);
    const toastId = toast.loading("Rendering animated avatar…");
    try {
      try {
        await provisionProfileAvatarStorageServer();
      } catch {
        // Server bucket provisioning requires SUPABASE_SERVICE_ROLE_KEY.
      }

      const animated = await renderGlbAnimatedAvatar(exportResult.url);

      publishAvatarMedia(userId, {
        avatarImageUrl: URL.createObjectURL(
          animated.mimeType.startsWith("video/") ? animated.video : animated.poster,
        ),
        avatarMediaType: animated.mimeType.startsWith("video/") ? "video" : "image",
        avatarCrop: null,
      });

      const posterFile = new File([animated.poster], "avaturn-poster.png", {
        type: "image/png",
      });
      const posterSaved = await saveUserProfileAvatarMedia({
        userId,
        fullName,
        avatar,
        file: posterFile,
        mediaType: "image",
        crop: null,
      });

      const isVideo = animated.mimeType.startsWith("video/");
      const animatedFile = new File(
        [animated.video],
        isVideo ? "avaturn-avatar.webm" : "avaturn-avatar.png",
        { type: animated.mimeType },
      );
      const media = await saveUserProfileAvatarMedia({
        userId,
        fullName,
        avatar,
        file: animatedFile,
        mediaType: isVideo ? "video" : "image",
        crop: isVideo
          ? { ...defaultAvatarCrop(), posterUrl: posterSaved.avatarImageUrl }
          : null,
      });
      publishAvatarMedia(userId, media);
      onMediaSaved?.(media);

      const avatarGlbUrl = await resolveAvaturnGlbStorageUrl(exportResult, userId);
      await upsertUserAvatarGlb({
        userId,
        avatarGlbUrl,
        fullName,
        avatar,
      });
      onSaved?.(avatarGlbUrl);

      toast.success("3D avatar saved — animated profile photo updated.", { id: toastId });
      setAvaturnOpen(false);
      onOpenChange(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your 3D avatar. Please try again.",
        { id: toastId },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile avatar</DialogTitle>
            <DialogDescription>
              Upload a photo, GIF, or short video — or create a 3D map character with Avaturn.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={PROFILE_AVATAR_ACCEPT}
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />

            <button
              type="button"
              onClick={handlePickFile}
              disabled={saving}
              className="group relative cursor-pointer outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
              aria-label="Upload profile avatar"
            >
              <ProfileAvatarDisplay
                initials={avatar}
                avatarImageUrl={displayedMedia?.avatarImageUrl}
                avatarMediaType={displayedMedia?.avatarMediaType}
                avatarCrop={displayedMedia?.avatarCrop}
                className="h-20 w-20 text-xl"
              />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/0 transition group-hover:bg-black/35">
                <ImagePlus className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" />
              </span>
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Click the avatar to upload JPG, PNG, WebP, GIF, or a video under 10 seconds. Drag and
              zoom to crop.
            </p>

            {avatarGlbUrl ? (
              <p className="text-center text-xs text-muted-foreground">
                You have a 3D map avatar. Create a new one anytime to replace it.
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                setAvaturnOpen(true);
              }}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Box className="mr-2 h-4 w-4" />
              )}
              Create 3D Avatar (Avaturn)
            </Button>

            <div className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2 text-xs text-muted-foreground">
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span>Avaturn uses your camera for a selfie-based 3D character on the map.</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AvatarMediaCropper
        open={cropOpen}
        onOpenChange={(next) => {
          setCropOpen(next);
          if (!next) {
            setPendingFile(null);
            setPendingMediaType(null);
          }
        }}
        file={pendingFile}
        mediaType={pendingMediaType}
        onConfirm={(crop) => void handleCropConfirm(crop)}
        saving={saving}
      />

      <AvaturnAvatarModal
        open={avaturnOpen}
        onOpenChange={(next) => {
          setAvaturnOpen(next);
          if (!next && !saving) {
            onOpenChange(true);
          }
        }}
        userId={userId}
        onExport={(result) => void handleAvaturnExport(result)}
      />
    </>
  );
}

interface ProfileAvatarEditTriggerProps {
  userId: string;
  fullName: string;
  avatar: string;
  avatarGlbUrl?: string | null;
  avatarMedia?: ProfileAvatarMedia | null;
  onSaved?: (avatarGlbUrl: string) => void;
  onMediaSaved?: (media: ProfileAvatarMedia) => void;
}

export function ProfileAvatarEditTrigger({
  userId,
  fullName,
  avatar,
  avatarGlbUrl,
  avatarMedia,
  onSaved,
  onMediaSaved,
}: ProfileAvatarEditTriggerProps) {
  const [open, setOpen] = useState(false);
  const { getAvatarMedia } = useProfileAvatar();
  const displayedMedia = getAvatarMedia(userId) ?? avatarMedia;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative shrink-0 outline-none ring-offset-background transition hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        aria-label="Edit avatar"
      >
        <ProfileAvatarDisplay
          initials={avatar}
          avatarImageUrl={displayedMedia?.avatarImageUrl}
          avatarMediaType={displayedMedia?.avatarMediaType}
          avatarCrop={displayedMedia?.avatarCrop}
          className="h-16 w-16 text-lg"
        />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border border-background bg-surface-2 text-foreground shadow-sm transition group-hover:bg-primary group-hover:text-primary-foreground">
          <ImagePlus className="h-3 w-3" />
        </span>
      </button>

      <ProfileAvatarEditModal
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        fullName={fullName}
        avatar={avatar}
        avatarGlbUrl={avatarGlbUrl}
        avatarMedia={avatarMedia}
        onSaved={onSaved}
        onMediaSaved={onMediaSaved}
      />
    </>
  );
}
