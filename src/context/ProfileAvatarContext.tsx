import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProfileAvatarMedia } from "@/lib/profile-avatar-media";
import {
  fetchUserProfileAvatarMedia,
  readProfileAvatarMediaCache,
  writeProfileAvatarMediaCacheEntry,
} from "@/services/profile-avatar";
import { useAuth } from "@/context/AuthContext";

interface ProfileAvatarContextValue {
  getAvatarMedia: (userId: string) => ProfileAvatarMedia | null;
  publishAvatarMedia: (userId: string, media: ProfileAvatarMedia) => void;
  prefetchAvatarMedia: (userId: string) => Promise<ProfileAvatarMedia | null>;
}

const ProfileAvatarContext = createContext<ProfileAvatarContextValue | null>(null);

export function ProfileAvatarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mediaByUserId, setMediaByUserId] = useState<Record<string, ProfileAvatarMedia>>(() =>
    readProfileAvatarMediaCache(),
  );

  const publishAvatarMedia = useCallback((userId: string, media: ProfileAvatarMedia) => {
    writeProfileAvatarMediaCacheEntry(userId, media);
    setMediaByUserId((prev) => ({ ...prev, [userId]: media }));
  }, []);

  const getAvatarMedia = useCallback(
    (userId: string) => mediaByUserId[userId] ?? null,
    [mediaByUserId],
  );

  const prefetchAvatarMedia = useCallback(
    async (userId: string) => {
      const cached = mediaByUserId[userId];
      if (cached?.avatarImageUrl) return cached;

      const remote = await fetchUserProfileAvatarMedia(userId);
      if (remote) {
        publishAvatarMedia(userId, remote);
      }
      return remote;
    },
    [mediaByUserId, publishAvatarMedia],
  );

  useEffect(() => {
    if (!user?.id) return;
    void prefetchAvatarMedia(user.id);
  }, [user?.id, prefetchAvatarMedia]);

  const value = useMemo(
    () => ({
      getAvatarMedia,
      publishAvatarMedia,
      prefetchAvatarMedia,
    }),
    [getAvatarMedia, publishAvatarMedia, prefetchAvatarMedia],
  );

  return (
    <ProfileAvatarContext.Provider value={value}>{children}</ProfileAvatarContext.Provider>
  );
}

export function useProfileAvatar() {
  const context = useContext(ProfileAvatarContext);
  if (!context) {
    throw new Error("useProfileAvatar must be used within ProfileAvatarProvider");
  }
  return context;
}

export function useUserAvatarMedia(userId: string | null | undefined) {
  const { getAvatarMedia, prefetchAvatarMedia } = useProfileAvatar();

  useEffect(() => {
    if (!userId) return;
    if (getAvatarMedia(userId)) return;
    void prefetchAvatarMedia(userId);
  }, [userId, getAvatarMedia, prefetchAvatarMedia]);

  if (!userId) return null;
  return getAvatarMedia(userId);
}
