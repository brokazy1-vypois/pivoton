import { useEffect, useRef, useState } from "react";
import {
  defaultAvatarCrop,
  fitScaleForViewport,
  isDefaultAvatarCrop,
  type ProfileAvatarCrop,
  type ProfileAvatarMediaType,
} from "@/lib/profile-avatar-media";
import { cn } from "@/lib/utils";

interface ProfileAvatarDisplayProps {
  initials: string;
  avatarImageUrl?: string | null;
  avatarMediaType?: ProfileAvatarMediaType | null;
  avatarCrop?: ProfileAvatarCrop | null;
  className?: string;
}

const CROP_VIEWPORT = 280;

export function ProfileAvatarDisplay({
  initials,
  avatarImageUrl,
  avatarMediaType,
  avatarCrop,
  className,
}: ProfileAvatarDisplayProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [containerSize, setContainerSize] = useState(64);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [videoFailed, setVideoFailed] = useState(false);

  const crop = avatarCrop ?? defaultAvatarCrop();
  const posterUrl = crop.posterUrl ?? null;
  const isVideo = avatarMediaType === "video" && !videoFailed;
  const isGif = avatarMediaType === "gif";
  const displayUrl =
    isVideo || isGif ? avatarImageUrl : videoFailed && posterUrl ? posterUrl : avatarImageUrl;
  const hasMedia = Boolean(displayUrl);
  const useCropLayout = !isDefaultAvatarCrop(crop);

  useEffect(() => {
    setVideoFailed(false);
    setNaturalSize({ width: 0, height: 0 });
  }, [avatarImageUrl, avatarMediaType]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => setContainerSize(node.clientWidth || 64);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fitScale =
    naturalSize.width && naturalSize.height
      ? fitScaleForViewport(naturalSize.width, naturalSize.height, containerSize)
      : 1;
  const displayScale = fitScale * crop.scale;
  const drawWidth = naturalSize.width * displayScale;
  const drawHeight = naturalSize.height * displayScale;
  const ratio = containerSize / CROP_VIEWPORT;

  const cropMediaStyle =
    naturalSize.width && naturalSize.height
      ? {
          width: drawWidth,
          height: drawHeight,
          transform: `translate(calc(-50% + ${crop.offsetX * ratio}px), calc(-50% + ${crop.offsetY * ratio}px))`,
        }
      : undefined;

  const centeredMediaClass = useCropLayout
    ? "absolute left-1/2 top-1/2 max-w-none select-none"
    : "absolute inset-0 h-full w-full select-none object-cover object-center";

  const onMediaMetrics = (width: number, height: number) => {
    if (useCropLayout) {
      setNaturalSize({ width, height });
    }
  };

  return (
    <span
      ref={containerRef}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full",
        hasMedia
          ? "bg-transparent ring-1 ring-border/40"
          : "grid place-items-center bg-primary font-bold text-primary-foreground",
        className,
      )}
    >
      {hasMedia ? (
        isVideo ? (
          <video
            key={displayUrl ?? "avatar-video"}
            src={displayUrl!}
            className={centeredMediaClass}
            style={useCropLayout ? cropMediaStyle : undefined}
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={(event) => {
              onMediaMetrics(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
            }}
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <img
            key={displayUrl ?? "avatar-image"}
            src={displayUrl!}
            alt=""
            draggable={false}
            className={centeredMediaClass}
            style={useCropLayout ? cropMediaStyle : undefined}
            onLoad={(event) => {
              onMediaMetrics(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
            }}
          />
        )
      ) : (
        initials
      )}
    </span>
  );
}
