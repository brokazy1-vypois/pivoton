import { ProfileAvatarDisplay } from "@/components/profile/ProfileAvatarDisplay";
import { useUserAvatarMedia } from "@/context/ProfileAvatarContext";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId: string;
  initials: string;
  className?: string;
}

/** Circular avatar that syncs globally via ProfileAvatarContext. */
export function UserAvatar({ userId, initials, className }: UserAvatarProps) {
  const media = useUserAvatarMedia(userId);

  return (
    <ProfileAvatarDisplay
      initials={initials}
      avatarImageUrl={media?.avatarImageUrl}
      avatarMediaType={media?.avatarMediaType}
      avatarCrop={media?.avatarCrop}
      className={cn(className)}
    />
  );
}
