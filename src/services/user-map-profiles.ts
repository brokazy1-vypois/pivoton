import { SEED_USERS } from "@/data/seed-hope-posts";
import {
  DEFAULT_MAP_CENTER,
  isPostInBounds,
  type GeoCoordinate,
  type MapViewportBounds,
} from "@/lib/hope-geo";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { UserMapLocation, UserMapProfile } from "@/types/user-map-profile";

const LOCAL_PROFILES_KEY = "pivoton-user-map-profiles";

const SEED_PROFILE_LOCATIONS: UserMapProfile[] = [
  {
    user_id: "seed-amelia",
    full_name: "Amelia Roux",
    avatar: "AR",
    latitude: 37.8087,
    longitude: -122.4098,
    city: "San Francisco",
    region: "North Beach",
    address_line: "North Beach, San Francisco",
  },
  {
    user_id: "seed-daniel",
    full_name: "Daniel Okafor",
    avatar: "DO",
    latitude: 37.7817,
    longitude: -122.4111,
    city: "San Francisco",
    region: "SOMA",
    address_line: "SOMA, San Francisco",
  },
  {
    user_id: "seed-marisol",
    full_name: "Marisol Vega",
    avatar: "MV",
    latitude: 37.8024,
    longitude: -122.4482,
    city: "San Francisco",
    region: "Marina District",
    address_line: "Marina District, San Francisco",
  },
  {
    user_id: "seed-hana",
    full_name: "Hana Ito",
    avatar: "HI",
    latitude: 37.8024,
    longitude: -122.4382,
    city: "San Francisco",
    region: "Marina District",
    address_line: "Chestnut St, San Francisco",
  },
  {
    user_id: "seed-marcus",
    full_name: "Marcus Vance",
    avatar: "MC",
    latitude: 37.7955,
    longitude: -122.3937,
    city: "San Francisco",
    region: "Embarcadero",
    address_line: "Embarcadero, San Francisco",
  },
];

function readLocalProfiles(): UserMapProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as UserMapProfile[]) : [];
  } catch {
    return [];
  }
}

function writeLocalProfiles(profiles: UserMapProfile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
}

function mapProfileRow(row: Record<string, unknown>): UserMapProfile | null {
  const latitude = row.latitude != null ? Number(row.latitude) : NaN;
  const longitude = row.longitude != null ? Number(row.longitude) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    user_id: String(row.user_id),
    full_name: String(row.full_name ?? ""),
    avatar: String(row.avatar ?? ""),
    avatar_glb_url: row.avatar_glb_url ? String(row.avatar_glb_url) : null,
    latitude,
    longitude,
    city: row.city ? String(row.city) : null,
    region: row.region ? String(row.region) : null,
    address_line: row.address_line ? String(row.address_line) : null,
  };
}

function seedLocalProfilesIfEmpty() {
  const local = readLocalProfiles();
  if (local.length >= SEED_PROFILE_LOCATIONS.length) return;

  const byId = new Map<string, UserMapProfile>();
  for (const profile of [...SEED_PROFILE_LOCATIONS, ...local]) {
    byId.set(profile.user_id, profile);
  }
  writeLocalProfiles(Array.from(byId.values()));
}

export async function fetchAllUserMapProfiles(): Promise<UserMapProfile[]> {
  seedLocalProfilesIfEmpty();

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "user_id, full_name, avatar, avatar_glb_url, latitude, longitude, city, region, address_line",
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (!error && data?.length) {
      const remote = data
        .map((row) => mapProfileRow(row as Record<string, unknown>))
        .filter((profile): profile is UserMapProfile => profile != null);

      const map = new Map<string, UserMapProfile>();
      for (const profile of [...SEED_PROFILE_LOCATIONS, ...readLocalProfiles(), ...remote]) {
        map.set(profile.user_id, profile);
      }
      const merged = Array.from(map.values());
      writeLocalProfiles(merged);
      return merged;
    }
  }

  const map = new Map<string, UserMapProfile>();
  for (const profile of [...SEED_PROFILE_LOCATIONS, ...readLocalProfiles()]) {
    map.set(profile.user_id, profile);
  }
  return Array.from(map.values());
}

export async function fetchRegisteredUserLocation(userId: string): Promise<UserMapLocation | null> {
  const profiles = await fetchAllUserMapProfiles();
  const profile = profiles.find((item) => item.user_id === userId);
  if (!profile) return null;

  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    label: profile.address_line ?? profile.region ?? profile.city ?? "Registered address",
  };
}

export function filterProfilesInBounds(
  profiles: UserMapProfile[],
  bounds: MapViewportBounds,
): UserMapProfile[] {
  return profiles.filter((profile) =>
    isPostInBounds(
      {
        id: profile.user_id,
        user_id: profile.user_id,
        author_name: profile.full_name,
        author_avatar: profile.avatar,
        job_role: null,
        content: "",
        likes_count: 0,
        created_at: new Date().toISOString(),
        latitude: profile.latitude,
        longitude: profile.longitude,
      },
      bounds,
    ),
  );
}

export async function upsertUserAvatarGlb(input: {
  userId: string;
  avatarGlbUrl: string;
  fullName?: string;
  avatar?: string;
}): Promise<void> {
  const local = readLocalProfiles();
  const existing = local.find((item) => item.user_id === input.userId);
  const fallbackCenter = DEFAULT_MAP_CENTER;
  const hasCoordinates =
    existing != null &&
    Number.isFinite(existing.latitude) &&
    Number.isFinite(existing.longitude) &&
    !(existing.latitude === 0 && existing.longitude === 0);

  const updatedProfile: UserMapProfile = existing
    ? {
        ...existing,
        avatar_glb_url: input.avatarGlbUrl,
        full_name: input.fullName ?? existing.full_name,
        avatar: input.avatar ?? existing.avatar,
        latitude: hasCoordinates ? existing.latitude : fallbackCenter.latitude,
        longitude: hasCoordinates ? existing.longitude : fallbackCenter.longitude,
      }
    : {
        user_id: input.userId,
        full_name: input.fullName ?? "",
        avatar: input.avatar ?? "",
        avatar_glb_url: input.avatarGlbUrl,
        latitude: fallbackCenter.latitude,
        longitude: fallbackCenter.longitude,
        city: "San Francisco",
        region: null,
        address_line: null,
      };
  writeLocalProfiles([updatedProfile, ...local.filter((item) => item.user_id !== input.userId)]);

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;

  const payload: Record<string, unknown> = {
    user_id: input.userId,
    avatar_glb_url: input.avatarGlbUrl,
    avatar_glb_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latitude: updatedProfile.latitude,
    longitude: updatedProfile.longitude,
  };

  if (input.fullName) payload.full_name = input.fullName;
  if (input.avatar) payload.avatar = input.avatar;
  if (!hasCoordinates && !existing?.city) payload.city = updatedProfile.city;

  const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("[Avatar] Could not sync GLB URL to user_profiles.", error.message);
  }
}

export async function fetchRegisteredUserProfile(
  userId: string,
): Promise<Pick<UserMapProfile, "user_id" | "full_name" | "avatar"> | null> {
  const local = readLocalProfiles().find((item) => item.user_id === userId);
  if (local?.full_name) {
    return {
      user_id: local.user_id,
      full_name: local.full_name,
      avatar: local.avatar,
    };
  }

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, avatar")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const fullName = data.full_name ? String(data.full_name) : "Member";

  return {
    user_id: String(data.user_id),
    full_name: fullName,
    avatar: String(data.avatar ?? ""),
  };
}

export async function fetchUserAvatarGlb(userId: string): Promise<string | null> {
  const local = readLocalProfiles().find((item) => item.user_id === userId);
  if (local?.avatar_glb_url) return local.avatar_glb_url;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("avatar_glb_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.avatar_glb_url) return null;
  return String(data.avatar_glb_url);
}

export async function upsertCurrentUserMapProfile(input: {
  userId: string;
  fullName: string;
  avatar: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  addressLine?: string;
}): Promise<void> {
  const profile: UserMapProfile = {
    user_id: input.userId,
    full_name: input.fullName,
    avatar: input.avatar,
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city ?? null,
    region: input.region ?? null,
    address_line: input.addressLine ?? null,
  };

  const local = readLocalProfiles().filter((item) => item.user_id !== input.userId);
  writeLocalProfiles([profile, ...local]);

  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;

  await supabase.from("user_profiles").upsert(
    {
      user_id: input.userId,
      full_name: input.fullName,
      avatar: input.avatar,
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city ?? null,
      region: input.region ?? null,
      address_line: input.addressLine ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export function defaultRegisteredCenter(): GeoCoordinate {
  return DEFAULT_MAP_CENTER;
}

export function formatUserMapLocation(profile: UserMapProfile): string {
  return (
    profile.address_line?.trim() ||
    [profile.region, profile.city].filter(Boolean).join(", ") ||
    profile.full_name
  );
}

export function searchUserMapProfiles(
  profiles: UserMapProfile[],
  query: string,
  limit = 8,
): UserMapProfile[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return profiles
    .filter((profile) => {
      const haystack = [
        profile.full_name,
        profile.avatar,
        profile.city,
        profile.region,
        profile.address_line,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, limit);
}

/** Build seed profile list from hope-feed seed users when DB is empty. */
export function buildSeedProfilesFromUsers(): UserMapProfile[] {
  return SEED_USERS.map((user, index) => {
    const seed = SEED_PROFILE_LOCATIONS[index % SEED_PROFILE_LOCATIONS.length];
    return {
      user_id: user.id,
      full_name: user.fullName,
      avatar: user.avatar,
      latitude: seed.latitude,
      longitude: seed.longitude,
      city: seed.city,
      region: seed.region,
      address_line: seed.address_line,
    };
  });
}
