import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ContactSearchMap, type MapLocationClick } from "@/components/hope-feed/ContactSearchMap";
import { ContactUserSearchBar } from "@/components/hope-feed/ContactUserSearchBar";
import { TrendingHopesPanel } from "@/components/hope-feed/TrendingHopesPanel";
import { MapLocationDetailPanel } from "@/components/hangout/MapLocationDetailPanel";
import { useHangout } from "@/context/HangoutContext";
import { useUserMapCenter } from "@/hooks/useUserMapCenter";
import {
  enrichHopePostsWithGeo,
  rankTrendingHopePosts,
  type GeoCoordinate,
  type MapViewportBounds,
} from "@/lib/hope-geo";
import { fetchVenueAtCoordinate, pickPoiFromMapFeatures, buildFallbackVenue } from "@/lib/mapbox-places";
import {
  fetchAllUserMapProfiles,
  filterProfilesInBounds,
  formatUserMapLocation,
} from "@/services/user-map-profiles";
import type { HopeComment, HopePost } from "@/types/hope-post";
import type { AppUser } from "@/types/hope-post";
import type { UserMapProfile } from "@/types/user-map-profile";

interface ContactSearchViewProps {
  posts: HopePost[];
  commentsByPost: Record<string, HopeComment[]>;
  user: AppUser | null;
  isLoading?: boolean;
}

function initialBounds(center: GeoCoordinate): MapViewportBounds {
  const latPad = 0.04;
  const lngPad = 0.05;
  return {
    north: center.latitude + latPad,
    south: center.latitude - latPad,
    east: center.longitude + lngPad,
    west: center.longitude - lngPad,
  };
}

export function ContactSearchView({
  posts,
  commentsByPost,
  user,
  isLoading,
}: ContactSearchViewProps) {
  const { center: geoCenter, locationLabel: geoLabel, isLocating } = useUserMapCenter(user);
  const { selectedVenue, locationPanelOpen, openVenue, closeVenue, openScheduling } = useHangout();
  const [bounds, setBounds] = useState<MapViewportBounds>(() => initialBounds(geoCenter));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isResolvingVenue, setIsResolvingVenue] = useState(false);
  const [mapFocus, setMapFocus] = useState<{
    center: GeoCoordinate;
    label: string;
    userId: string;
  } | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["user-map-profiles"],
    queryFn: fetchAllUserMapProfiles,
    staleTime: 60_000,
  });

  const allProfiles = profilesQuery.data ?? [];

  const geoPosts = useMemo(
    () => enrichHopePostsWithGeo(posts, mapFocus?.center ?? geoCenter),
    [posts, geoCenter, mapFocus?.center],
  );

  const replyCountByPost = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [postId, comments] of Object.entries(commentsByPost)) {
      counts[postId] = comments.length;
    }
    return counts;
  }, [commentsByPost]);

  const nearbyUsers = useMemo(() => {
    const inBounds = filterProfilesInBounds(allProfiles, bounds);
    if (!mapFocus) return inBounds;

    const focusedProfile = allProfiles.find((profile) => profile.user_id === mapFocus.userId);
    if (!focusedProfile || inBounds.some((profile) => profile.user_id === mapFocus.userId)) {
      return inBounds;
    }

    return [focusedProfile, ...inBounds];
  }, [allProfiles, bounds, mapFocus]);

  const trendingPosts = useMemo(
    () => rankTrendingHopePosts(geoPosts, bounds, replyCountByPost, 12),
    [geoPosts, bounds, replyCountByPost],
  );

  const activeLabel = mapFocus?.label ?? geoLabel;
  const flyToCenter = mapFocus?.center ?? (isLocating ? null : geoCenter);
  const lightingCenter = mapFocus?.center ?? geoCenter;

  useEffect(() => {
    if (mapFocus) return;
    setBounds(initialBounds(geoCenter));
  }, [geoCenter.latitude, geoCenter.longitude, mapFocus]);

  const handleSelectPost = useCallback((postId: string) => {
    setMapFocus(null);
    closeVenue();
    setSelectedPostId(postId);
  }, [closeVenue]);

  const handleSelectUser = useCallback((profile: UserMapProfile) => {
    setSelectedPostId(null);
    closeVenue();
    setMapFocus({
      userId: profile.user_id,
      center: { latitude: profile.latitude, longitude: profile.longitude },
      label: formatUserMapLocation(profile),
    });
  }, [closeVenue]);

  const handleMapLocationClick = useCallback(
    async (click: MapLocationClick) => {
      setIsResolvingVenue(true);
      try {
        const coordinate = { latitude: click.latitude, longitude: click.longitude };
        const venue =
          pickPoiFromMapFeatures(click.features ?? [], coordinate) ??
          (await fetchVenueAtCoordinate(coordinate, click.featureName)) ??
          buildFallbackVenue(coordinate, click.featureName ?? "Selected location");

        openVenue(venue);
      } catch {
        toast.error("Could not load venue details for this location.");
      } finally {
        setIsResolvingVenue(false);
      }
    },
    [openVenue],
  );

  return (
    <div>
      <h1 className="text-4xl font-semibold sm:text-5xl">Contact Search</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Explore hopes on an interactive 3D neighborhood map centered on{" "}
        <span className="text-foreground">{activeLabel}</span>
        {isLocating && !mapFocus ? " — locating…" : "."} {nearbyUsers.length} members visible in
        this region.
      </p>

      <div className="mt-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <ContactUserSearchBar
            profiles={allProfiles}
            isLoading={profilesQuery.isLoading}
            onSelectUser={handleSelectUser}
          />

          <div className="relative">
            <ContactSearchMap
              posts={geoPosts}
              users={nearbyUsers}
              initialCenter={geoCenter}
              flyToCenter={flyToCenter}
              lightingCenter={lightingCenter}
              currentUserId={user?.id ?? null}
              selectedPostId={selectedPostId}
              focusUserId={mapFocus?.userId ?? null}
              onBoundsChange={setBounds}
              onSelectPost={handleSelectPost}
              onLocationClick={handleMapLocationClick}
            />

            {isResolvingVenue && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[#070b14]/50">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {selectedVenue && (
              <MapLocationDetailPanel
                venue={selectedVenue}
                open={locationPanelOpen}
                onClose={closeVenue}
                onHangout={openScheduling}
              />
            )}
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <TrendingHopesPanel
            posts={trendingPosts}
            replyCountByPost={replyCountByPost}
            selectedPostId={selectedPostId}
            onSelectPost={handleSelectPost}
            isLoading={isLoading || isLocating || profilesQuery.isLoading}
          />
        </aside>
      </div>
    </div>
  );
}
