import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  defaultAvatarCrop,
  fitScaleForViewport,
  type ProfileAvatarCrop,
  type ProfileAvatarMediaType,
} from "@/lib/profile-avatar-media";
import { cn } from "@/lib/utils";

const VIEWPORT_SIZE = 280;

interface AvatarMediaCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  mediaType: ProfileAvatarMediaType | null;
  onConfirm: (crop: ProfileAvatarCrop) => void;
  saving?: boolean;
}

export function AvatarMediaCropper({
  open,
  onOpenChange,
  file,
  mediaType,
  onConfirm,
  saving = false,
}: AvatarMediaCropperProps) {
  const [crop, setCrop] = useState<ProfileAvatarCrop>(defaultAvatarCrop());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open || !file) {
      setPreviewUrl(null);
      setNaturalSize({ width: 0, height: 0 });
      setCrop(defaultAvatarCrop());
      return;
    }

    setLoading(true);
    setCrop(defaultAvatarCrop());
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    if (mediaType === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setNaturalSize({ width: video.videoWidth, height: video.videoHeight });
        setLoading(false);
      };
      video.onerror = () => setLoading(false);
      video.src = objectUrl;
    } else {
      const image = new Image();
      image.onload = () => {
        setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
        setLoading(false);
      };
      image.onerror = () => setLoading(false);
      image.src = objectUrl;
    }

    return () => URL.revokeObjectURL(objectUrl);
  }, [open, file, mediaType]);

  const fitScale =
    naturalSize.width && naturalSize.height
      ? fitScaleForViewport(naturalSize.width, naturalSize.height, VIEWPORT_SIZE)
      : 1;

  const displayScale = fitScale * crop.scale;
  const drawWidth = naturalSize.width * displayScale;
  const drawHeight = naturalSize.height * displayScale;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.offsetX,
      originY: crop.offsetY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setCrop((prev) => ({
      ...prev,
      offsetX: dragRef.current!.originX + dx,
      offsetY: dragRef.current!.originY + dy,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setCrop((prev) => ({
      ...prev,
      scale: Math.min(3, Math.max(1, prev.scale + delta)),
    }));
  }, []);

  const mediaStyle = {
    width: drawWidth || "100%",
    height: drawHeight || "100%",
    transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust your avatar</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom. Your selection is cropped to a circle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className={cn(
              "relative touch-none overflow-hidden rounded-full border-2 border-primary/40 bg-[#0a0f18]",
              "cursor-grab active:cursor-grabbing",
            )}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {loading && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/70">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {previewUrl && mediaType === "video" ? (
              <video
                ref={videoRef}
                src={previewUrl}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={mediaStyle}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : previewUrl ? (
              <img
                ref={imageRef}
                src={previewUrl}
                alt="Avatar preview"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={mediaStyle}
              />
            ) : null}

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{
                boxShadow: "inset 0 0 0 9999px rgba(0,0,0,0.35)",
                mask: "radial-gradient(circle 140px at center, transparent 139px, black 140px)",
                WebkitMask: "radial-gradient(circle 140px at center, transparent 139px, black 140px)",
              }}
            />
          </div>

          <div className="flex w-full items-center gap-3 px-1">
            <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[crop.scale]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={([value]) => setCrop((prev) => ({ ...prev, scale: value }))}
              aria-label="Zoom avatar"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(crop)} disabled={saving || loading || !file}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save avatar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
