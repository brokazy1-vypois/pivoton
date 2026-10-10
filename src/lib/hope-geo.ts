import type { HopePost } from "@/types/hope-post";
import type { AppUser } from "@/types/hope-post";

export interface MapViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export const DEFAULT_MAP_CENTER: GeoCoordinate = {
  latitude: 37.7749,
  longitude: -122.4194,
};

const SEED_NEIGHBORHOODS: Array<{ latitude: number; longitude: number; label: string }> = [
  { latitude: 37.7879, longitude: -122.4075, label: "Union Square" },
  { latitude: 37.7596, longitude: -122.4269, label: "Mission District" },
  { latitude: 37.7694, longitude: -122.4862, label: "Golden Gate Park" },
  { latitude: 37.7955, longitude: -122.3937, label: "Embarcadero" },
  { latitude: 37.8024, longitude: -122.4482, label: "Marina District" },
  { latitude: 37.7648, longitude: -122.463, label: "Sunset District" },
  { latitude: 37.7817, longitude: -122.4111, label: "SOMA" },
  { latitude: 37.8087, longitude: -122.4098, label: "North Beach" },
];

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveUserMapCenter(user: AppUser | null): GeoCoordinate {
  if (user && typeof window !== "undefined") {
    const meta = (user as AppUser & { homeLatitude?: number; homeLongitude?: number });
    if (meta.homeLatitude != null && meta.homeLongitude != null) {
      return { latitude: meta.homeLatitude, longitude: meta.homeLongitude };
    }
  }

  return DEFAULT_MAP_CENTER;
}

export function enrichHopePostWithGeo(post: HopePost, index: number, center: GeoCoordinate): HopePost {
  if (post.latitude != null && post.longitude != null) {
    return post;
  }

  const neighborhood = SEED_NEIGHBORHOODS[index % SEED_NEIGHBORHOODS.length];
  const hash = hashSeed(post.id);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 0.004 + (hash % 40) * 0.00015;

  return {
    ...post,
    latitude: neighborhood.latitude + Math.sin(angle) * radius,
    longitude: neighborhood.longitude + Math.cos(angle) * radius,
    location_label: post.location_label ?? neighborhood.label,
  };
}

export function enrichHopePostsWithGeo(posts: HopePost[], center: GeoCoordinate): HopePost[] {
  return posts.map((post, index) => enrichHopePostWithGeo(post, index, center));
}

export function isPostInBounds(post: HopePost, bounds: MapViewportBounds): boolean {
  if (post.latitude == null || post.longitude == null) return false;

  const latInRange = post.latitude <= bounds.north && post.latitude >= bounds.south;
  if (!latInRange) return false;

  if (bounds.west <= bounds.east) {
    return post.longitude >= bounds.west && post.longitude <= bounds.east;
  }

  return post.longitude >= bounds.west || post.longitude <= bounds.east;
}

export function hopeEngagementScore(post: HopePost, replyCount: number): number {
  return post.likes_count + replyCount * 2;
}

export function rankTrendingHopePosts(
  posts: HopePost[],
  bounds: MapViewportBounds,
  replyCountByPost: Record<string, number>,
  limit = 12,
): HopePost[] {
  return posts
    .filter((post) => isPostInBounds(post, bounds))
    .sort((a, b) => {
      const scoreA = hopeEngagementScore(a, replyCountByPost[a.id] ?? 0);
      const scoreB = hopeEngagementScore(b, replyCountByPost[b.id] ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

export function boundsFromMapboxLngLatBounds(bounds: {
  getNorth: () => number;
  getSouth: () => number;
  getEast: () => number;
  getWest: () => number;
}): MapViewportBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}
