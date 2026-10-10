import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyMapboxStandardScene,
  attachMapMarker,
  AUTOMOTIVE_CAMERA,
  AUTOMOTIVE_FLY_TO,
  buildStandardBasemapConfig,
  createMapMarkerElement,
  MAPBOX_STANDARD_STYLE,
  standardMapLegendLabel,
} from "@/lib/mapbox-automotive-scene";
import {
  msUntilNextLocalHour,
  resolveLightPresetForCoordinate,
  type MapboxLightPreset,
} from "@/lib/mapbox-local-time";
import { getMapboxAccessToken, isMapboxConfigured } from "@/lib/mapbox-env";
import { MapAvatarModelManager, profileHasMapAvatar } from "@/lib/mapbox-avatar-models";
import {
  boundsFromMapboxLngLatBounds,
  type GeoCoordinate,
  type MapViewportBounds,
} from "@/lib/hope-geo";
import type { HopePost } from "@/types/hope-post";
import type { UserMapProfile } from "@/types/user-map-profile";

export interface MapLocationClick {
  latitude: number;
  longitude: number;
  featureName?: string;
  features?: Array<{
    id?: string | number;
    layer?: { id?: string; type?: string };
    properties?: Record<string, unknown>;
  }>;
}

interface ContactSearchMapProps {
  posts: HopePost[];
  users: UserMapProfile[];
  initialCenter: GeoCoordinate;
  flyToCenter: GeoCoordinate | null;
  lightingCenter: GeoCoordinate;
  currentUserId?: string | null;
  selectedPostId: string | null;
  focusUserId: string | null;
  onBoundsChange: (bounds: MapViewportBounds) => void;
  onSelectPost: (postId: string) => void;
  onLocationClick?: (click: MapLocationClick) => void;
}

export function ContactSearchMap({
  posts,
  users,
  initialCenter,
  flyToCenter,
  lightingCenter,
  currentUserId,
  selectedPostId,
  focusUserId,
  onBoundsChange,
  onSelectPost,
  onLocationClick,
}: ContactSearchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const postMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const avatarManagerRef = useRef<MapAvatarModelManager | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onSelectPostRef = useRef(onSelectPost);
  const onLocationClickRef = useRef(onLocationClick);
  const lastFlyTargetRef = useRef<string | null>(null);
  const lightingCenterRef = useRef(lightingCenter);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [lightPreset, setLightPreset] = useState<MapboxLightPreset>(() =>
    resolveLightPresetForCoordinate(lightingCenter),
  );

  lightingCenterRef.current = lightingCenter;

  onBoundsChangeRef.current = onBoundsChange;
  onSelectPostRef.current = onSelectPost;
  onLocationClickRef.current = onLocationClick;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || !isMapboxConfigured() || mapRef.current) return;

    mapboxgl.accessToken = getMapboxAccessToken();

    let disposed = false;
    let sceneConfigured = false;

    const initialPreset = resolveLightPresetForCoordinate(initialCenter);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STANDARD_STYLE,
      config: {
        basemap: buildStandardBasemapConfig(initialPreset),
      },
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: AUTOMOTIVE_CAMERA.zoom,
      pitch: AUTOMOTIVE_CAMERA.pitch,
      bearing: AUTOMOTIVE_CAMERA.bearing,
      antialias: true,
      hash: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: true,
      }),
      "top-right",
    );

    const emitBounds = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      onBoundsChangeRef.current(boundsFromMapboxLngLatBounds(bounds));
    };

    const syncLightingFromMapCenter = () => {
      const center = map.getCenter();
      const preset = applyMapboxStandardScene(map, {
        latitude: center.lat,
        longitude: center.lng,
      });
      setLightPreset(preset);
    };

    const handleReady = () => {
      if (disposed || sceneConfigured) return;
      sceneConfigured = true;

      try {
        const preset = applyMapboxStandardScene(map, lightingCenterRef.current);
        setLightPreset(preset);
      } catch {
        // Standard config is optional — basemap still renders.
      }

      map.resize();
      setMapReady(true);
      setMapError(null);
      emitBounds();
    };

    map.on("load", handleReady);
    map.on("style.load", handleReady);
    map.on("moveend", () => {
      emitBounds();
      syncLightingFromMapCenter();
    });
    map.on("click", (event) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-marker, button")) return;

      const features = map.queryRenderedFeatures(event.point);
      const namedFeature = features.find((feature) => {
        const properties = feature.properties ?? {};
        return Boolean(properties.name || properties.name_en || properties.class);
      });

      onLocationClickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        featureName:
          namedFeature?.properties?.name != null
            ? String(namedFeature.properties.name)
            : namedFeature?.properties?.name_en != null
              ? String(namedFeature.properties.name_en)
              : undefined,
        features,
      });
    });
    map.on("error", (event) => {
      const message =
        event.error?.message ??
        (typeof event.error === "string" ? event.error : "Mapbox failed to load tiles.");
      setMapError(message);
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    window.setTimeout(() => map.resize(), 150);
    window.setTimeout(() => map.resize(), 500);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      setMapReady(false);
      postMarkersRef.current.forEach((marker) => marker.remove());
      postMarkersRef.current.clear();
      userMarkersRef.current.forEach((marker) => marker.remove());
      userMarkersRef.current.clear();
      avatarManagerRef.current?.destroy();
      avatarManagerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once after mount
  }, [mounted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !flyToCenter) return;

    const targetKey = `${flyToCenter.latitude},${flyToCenter.longitude}`;
    if (lastFlyTargetRef.current === targetKey) return;
    lastFlyTargetRef.current = targetKey;

    map.flyTo({
      center: [flyToCenter.longitude, flyToCenter.latitude],
      zoom: AUTOMOTIVE_FLY_TO.zoom,
      pitch: AUTOMOTIVE_FLY_TO.pitch,
      bearing: AUTOMOTIVE_FLY_TO.bearing,
      duration: AUTOMOTIVE_FLY_TO.duration,
      essential: true,
    });
  }, [flyToCenter, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const syncLighting = () => {
      const preset = applyMapboxStandardScene(map, lightingCenterRef.current);
      setLightPreset(preset);
    };

    syncLighting();

    const intervalId = window.setInterval(() => {
      const center = map.getCenter();
      const preset = applyMapboxStandardScene(map, {
        latitude: center.lat,
        longitude: center.lng,
      });
      setLightPreset(preset);
    }, 60_000);

    const timeoutId = window.setTimeout(() => {
      const center = map.getCenter();
      applyMapboxStandardScene(map, { latitude: center.lat, longitude: center.lng });
      setLightPreset(resolveLightPresetForCoordinate({ latitude: center.lat, longitude: center.lng }));
    }, msUntilNextLocalHour(lightingCenter));

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [lightingCenter.latitude, lightingCenter.longitude, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!avatarManagerRef.current) {
      avatarManagerRef.current = new MapAvatarModelManager(map);
    }

    userMarkersRef.current.forEach((marker) => marker.remove());
    userMarkersRef.current.clear();

    const flatUsers = users.filter((profile) => !profileHasMapAvatar(profile));
    const avatarUsers = users.filter((profile) => profileHasMapAvatar(profile));

    for (const profile of flatUsers) {
      const isSelf = profile.user_id === currentUserId;
      const initials = (profile.avatar || profile.full_name).slice(0, 2).toUpperCase();
      const el = createMapMarkerElement({
        initials,
        title: `${profile.full_name}${profile.region ? ` · ${profile.region}` : ""}`,
        ariaLabel: `Member ${profile.full_name}`,
        variant: isSelf ? "self" : "member",
      });

      const marker = attachMapMarker(map, el, profile.longitude, profile.latitude);
      userMarkersRef.current.set(profile.user_id, marker);
    }

    avatarManagerRef.current.syncProfiles(avatarUsers, {
      currentUserId,
      focusUserId,
    });
  }, [users, mapReady, currentUserId, focusUserId]);

  useEffect(() => {
    userMarkersRef.current.forEach((marker, userId) => {
      const chip = marker.getElement().querySelector("span.relative");
      if (!chip) return;
      const isFocused = userId === focusUserId;
      chip.classList.toggle("ring-4", isFocused);
      chip.classList.toggle("ring-sky-300/80", isFocused);
      chip.classList.toggle("scale-125", isFocused);
      marker.getElement().style.zIndex = isFocused ? "40" : "10";
    });
  }, [focusUserId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    postMarkersRef.current.forEach((marker) => marker.remove());
    postMarkersRef.current.clear();

    for (const post of posts) {
      if (post.latitude == null || post.longitude == null) continue;

      const el = createMapMarkerElement({
        initials: post.author_avatar?.slice(0, 2) ?? "H",
        title: post.author_name,
        ariaLabel: `Hope by ${post.author_name}`,
        variant: "hope",
        onClick: () => onSelectPostRef.current(post.id),
      });

      const marker = attachMapMarker(map, el, post.longitude, post.latitude);
      postMarkersRef.current.set(post.id, marker);
    }
  }, [posts, mapReady]);

  useEffect(() => {
    postMarkersRef.current.forEach((marker, postId) => {
      const chip = marker.getElement().querySelector("span.relative");
      if (!chip) return;
      const isSelected = postId === selectedPostId;
      chip.classList.toggle("ring-4", isSelected);
      chip.classList.toggle("ring-primary/70", isSelected);
      chip.classList.toggle("scale-125", isSelected);
      marker.getElement().style.zIndex = isSelected ? "30" : "10";
    });
  }, [selectedPostId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedPostId) return;

    const post = posts.find((item) => item.id === selectedPostId);
    if (!post || post.latitude == null || post.longitude == null) return;

    map.flyTo({
      center: [post.longitude, post.latitude],
      zoom: AUTOMOTIVE_FLY_TO.zoom,
      pitch: AUTOMOTIVE_FLY_TO.pitch,
      bearing: AUTOMOTIVE_FLY_TO.bearing,
      duration: AUTOMOTIVE_FLY_TO.duration,
      essential: true,
    });
  }, [selectedPostId, posts, mapReady]);

  if (!mounted) {
    return (
      <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-border bg-[#070b14]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isMapboxConfigured()) {
    return (
      <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-border bg-[#070b14] p-8 text-center text-sm text-muted-foreground">
        Mapbox access token is missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment.
      </div>
    );
  }

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-border/80 bg-[#070b14] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
      <div ref={containerRef} className="h-full w-full" />

      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b14]/90">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {mapError && (
        <div className="absolute inset-x-4 top-4 z-20 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{mapError}</span>
        </div>
      )}

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          lightPreset === "day" || lightPreset === "dawn"
            ? "shadow-[inset_0_0_80px_rgba(0,0,0,0.12)]"
            : "shadow-[inset_0_0_140px_rgba(0,0,0,0.55)]",
        )}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-transparent p-4">
        <p className="text-xs text-slate-400">
          {standardMapLegendLabel(lightPreset)}. Click a store or landmark to Hangout. Pan to refresh trending posts.
        </p>
      </div>
    </div>
  );
}
