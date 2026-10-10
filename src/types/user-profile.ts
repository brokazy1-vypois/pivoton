import type { HopeUserProfile } from "@/types/hope-post";
import type { ProfileAvatarMedia } from "@/lib/profile-avatar-media";

export interface UserProfileView extends HopeUserProfile {
  handle: string;
  joinDate: string | null;
  hopeCount: number;
  goalsCompletedCount?: number;
  avatarMedia?: ProfileAvatarMedia | null;
}
