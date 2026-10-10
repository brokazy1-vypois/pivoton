import { profileFromPost, getSeedUserProfile } from "@/data/seed-hope-posts";
import { deriveUserHandle } from "@/lib/user-handle";
import { fetchUserHopePosts } from "@/services/hope-posts";
import { fetchUserProfileAvatarMedia } from "@/services/profile-avatar";
import { fetchRegisteredUserProfile } from "@/services/user-map-profiles";
import type { HopePost, HopeUserProfile } from "@/types/hope-post";
import type { UserProfileView } from "@/types/user-profile";

function initialsFromName(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export interface FetchUserProfileOptions {
  authFallback?: {
    fullName: string;
    avatar?: string | null;
    jobRole?: string | null;
  };
  /** Re-use timeline posts so header count and feed share one source. */
  posts?: HopePost[];
  authorName?: string | null;
}

function profileFromRegistered(
  userId: string,
  registered: { full_name: string; avatar: string },
): HopeUserProfile {
  return {
    id: userId,
    fullName: registered.full_name,
    job_role: "Member",
    avatar: registered.avatar || initialsFromName(registered.full_name),
  };
}

function profileFromAuthFallback(
  userId: string,
  fallback: NonNullable<FetchUserProfileOptions["authFallback"]>,
): HopeUserProfile {
  return {
    id: userId,
    fullName: fallback.fullName,
    job_role: fallback.jobRole ?? "Member",
    avatar: fallback.avatar ?? initialsFromName(fallback.fullName),
  };
}

export async function fetchUserProfile(
  userId: string,
  options?: FetchUserProfileOptions,
): Promise<UserProfileView | null> {
  const postsPromise =
    options?.posts !== undefined
      ? Promise.resolve(options.posts)
      : fetchUserHopePosts(userId, { authorName: options?.authorName });

  const [posts, seed, avatarMedia, registered] = await Promise.all([
    postsPromise,
    Promise.resolve(getSeedUserProfile(userId)),
    fetchUserProfileAvatarMedia(userId),
    fetchRegisteredUserProfile(userId),
  ]);

  let base: HopeUserProfile | null = null;

  if (posts.length > 0) {
    base = profileFromPost(posts[0]);
  } else if (seed) {
    base = seed;
  } else if (registered) {
    base = profileFromRegistered(userId, registered);
  } else if (options?.authFallback) {
    base = profileFromAuthFallback(userId, options.authFallback);
  }

  if (!base) {
    return null;
  }

  const joinDate =
    posts.length > 0
      ? posts.reduce((earliest, post) => {
          return new Date(post.created_at).getTime() < new Date(earliest).getTime()
            ? post.created_at
            : earliest;
        }, posts[0].created_at)
      : null;

  return {
    ...base,
    handle: deriveUserHandle(base.fullName, userId),
    joinDate,
    hopeCount: posts.length,
    avatarMedia,
  };
}
