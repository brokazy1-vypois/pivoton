import { formatJoinDate } from "@/lib/user-handle";
import { formatGoalsCompletedLabel, formatHopesLoggedLabel } from "@/lib/goal-stats";
import { ProfileAvatarDisplay } from "@/components/profile/ProfileAvatarDisplay";
import { ProfileAvatarEditTrigger } from "@/components/profile/ProfileAvatarEditModal";
import { UserProfileActions } from "@/components/hope-feed/UserProfileActions";
import { useProfileAvatar } from "@/context/ProfileAvatarContext";
import type { ProfileAvatarMedia } from "@/lib/profile-avatar-media";
import type { UserProfileView } from "@/types/user-profile";

interface UserProfileHeaderProps {
  profile: UserProfileView;
  isOwnProfile?: boolean;
  avatarGlbUrl?: string | null;
  avatarMedia?: ProfileAvatarMedia | null;
  onAvatarGlbSaved?: (url: string) => void;
  onAvatarMediaSaved?: (media: ProfileAvatarMedia) => void;
}

export function UserProfileHeader({
  profile,
  isOwnProfile = false,
  avatarGlbUrl,
  avatarMedia,
  onAvatarGlbSaved,
  onAvatarMediaSaved,
}: UserProfileHeaderProps) {
  const { getAvatarMedia } = useProfileAvatar();
  const media = getAvatarMedia(profile.id) ?? avatarMedia ?? profile.avatarMedia ?? null;

  return (
    <div className="panel p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {isOwnProfile ? (
            <ProfileAvatarEditTrigger
              userId={profile.id}
              fullName={profile.fullName}
              avatar={profile.avatar}
              avatarGlbUrl={avatarGlbUrl}
              avatarMedia={media}
              onSaved={onAvatarGlbSaved}
              onMediaSaved={onAvatarMediaSaved}
            />
          ) : (
            <ProfileAvatarDisplay
              initials={profile.avatar}
              avatarImageUrl={media?.avatarImageUrl}
              avatarMediaType={media?.avatarMediaType}
              avatarCrop={media?.avatarCrop}
              className="h-16 w-16 text-lg"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{profile.fullName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{profile.handle}</p>
            {isOwnProfile && avatarGlbUrl && (
              <p className="mt-1 text-xs text-primary/90">3D map avatar active</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.job_role} · Joined {formatJoinDate(profile.joinDate)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHopesLoggedLabel(profile.hopeCount)}
              {typeof profile.goalsCompletedCount === "number" ? (
                <>
                  {" · "}
                  {formatGoalsCompletedLabel(profile.goalsCompletedCount)}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <UserProfileActions
          targetUserId={profile.id}
          fullName={profile.fullName}
          targetAvatar={profile.avatar}
          className="grid w-full gap-2 sm:w-auto sm:min-w-[9rem]"
        />
      </div>
    </div>
  );
}
