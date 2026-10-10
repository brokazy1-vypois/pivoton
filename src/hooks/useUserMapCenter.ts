import { useEffect, useState } from "react";
import type { AppUser } from "@/types/hope-post";
import { DEFAULT_MAP_CENTER, type GeoCoordinate } from "@/lib/hope-geo";
import {
  fetchRegisteredUserLocation,
  upsertCurrentUserMapProfile,
} from "@/services/user-map-profiles";

async function reverseGeocodeLabel(latitude: number, longitude: number): Promise<string | null> {
  const token =
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
    import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: Array<{ place_name?: string }> };
    return data.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

export function useUserMapCenter(user: AppUser | null) {
  const [center, setCenter] = useState<GeoCoordinate>(DEFAULT_MAP_CENTER);
  const [locationLabel, setLocationLabel] = useState<string>("San Francisco Bay Area");
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveCenter() {
      setIsLocating(true);

      if (user) {
        const registered = await fetchRegisteredUserLocation(user.id);
        if (!cancelled && registered) {
          setCenter({ latitude: registered.latitude, longitude: registered.longitude });
          setLocationLabel(registered.label);
          setIsLocating(false);
          return;
        }
      }

      if (typeof window !== "undefined" && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              if (cancelled) {
                resolve();
                return;
              }

              const latitude = position.coords.latitude;
              const longitude = position.coords.longitude;
              setCenter({ latitude, longitude });

              const label =
                (await reverseGeocodeLabel(latitude, longitude)) ?? "Your current location";
              setLocationLabel(label);

              if (user) {
                void upsertCurrentUserMapProfile({
                  userId: user.id,
                  fullName: user.fullName,
                  avatar: user.avatar ?? user.fullName.slice(0, 2).toUpperCase(),
                  latitude,
                  longitude,
                  addressLine: label,
                });
              }

              setIsLocating(false);
              resolve();
            },
            () => {
              if (!cancelled) {
                setCenter(DEFAULT_MAP_CENTER);
                setLocationLabel("San Francisco Bay Area");
                setIsLocating(false);
              }
              resolve();
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
          );
        });
        return;
      }

      if (!cancelled) {
        setCenter(DEFAULT_MAP_CENTER);
        setLocationLabel("San Francisco Bay Area");
        setIsLocating(false);
      }
    }

    void resolveCenter();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.fullName, user?.avatar]);

  return { center, locationLabel, isLocating };
}
