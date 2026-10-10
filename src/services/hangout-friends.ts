import { DEMO_ACCOUNTS } from "@/types/hope-post";
import type { UserMapProfile } from "@/types/user-map-profile";
import type { HangoutFriend } from "@/types/hangout";

const DEMO_EMAIL_BY_NAME = Object.fromEntries(
  DEMO_ACCOUNTS.map((account) => [account.fullName.toLowerCase(), account.email]),
);

function emailForProfile(profile: UserMapProfile): string | null {
  const byName = DEMO_EMAIL_BY_NAME[profile.full_name.toLowerCase()];
  if (byName) return byName;

  const slug = profile.full_name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
  if (slug) return `${slug}@pivoton.demo`;
  return null;
}

export function mapProfilesToHangoutFriends(
  profiles: UserMapProfile[],
  currentUserId?: string | null,
): HangoutFriend[] {
  return profiles
    .filter((profile) => profile.user_id !== currentUserId)
    .map((profile) => ({
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar: profile.avatar,
      email: emailForProfile(profile),
      region: profile.region,
    }));
}
