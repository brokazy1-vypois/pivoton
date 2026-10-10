import { getSeedUserProfile } from "@/data/seed-hope-posts";
import type { ConnectionPeerSummary } from "@/types/connection";

export function peerSummaryFromUserId(userId: string): ConnectionPeerSummary {
  const seed = getSeedUserProfile(userId);
  if (seed) {
    return {
      user_id: userId,
      full_name: seed.fullName,
      avatar: seed.avatar,
      job_role: seed.job_role,
    };
  }

  return {
    user_id: userId,
    full_name: userId.replace(/^seed-/, "").replace(/-/g, " "),
    avatar: userId.slice(0, 2).toUpperCase(),
    job_role: null,
  };
}
