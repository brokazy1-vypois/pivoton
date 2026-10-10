import { getMapboxAccessToken } from "@/lib/mapbox-env";
import type { GeoCoordinate } from "@/lib/hope-geo";
import type { HangoutVenue } from "@/types/hangout";

interface MapboxGeocodeFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  properties?: {
    category?: string;
    maki?: string;
    address?: string;
  };
  context?: Array<{ id?: string; text?: string }>;
}

interface MapboxGeocodeResponse {
  features?: MapboxGeocodeFeature[];
}

function token(): string {
  return getMapboxAccessToken();
}

function buildVenuePhotoUrl(coordinate: GeoCoordinate, label: string): string | null {
  const accessToken = token();
  if (!accessToken) return null;

  const { longitude, latitude } = coordinate;
  const pin = `pin-s+cafe+285A98(${longitude},${latitude})`;
  return `https://api.mapbox.com/styles/v1/mapbox/standard/static/${pin}/${longitude},${latitude},16.8,58,0/640x360@2x?access_token=${accessToken}`;
}

function featureToVenue(feature: MapboxGeocodeFeature, coordinate: GeoCoordinate): HangoutVenue {
  const name = feature.text ?? feature.place_name?.split(",")[0] ?? "Selected location";
  const address = feature.place_name ?? `${coordinate.latitude}, ${coordinate.longitude}`;
  const category =
    feature.properties?.category ??
    feature.properties?.maki ??
    feature.place_type?.[0] ??
    null;

  const neighborhood = feature.context?.find((item) => item.id?.startsWith("neighborhood"))?.text;
  const description = category
    ? `${name} is a local ${category.replace(/_/g, " ")}${neighborhood ? ` in ${neighborhood}` : ""}.`
    : `Meet up at ${name}${neighborhood ? ` in ${neighborhood}` : ""}.`;

  return {
    id: feature.id ?? `${coordinate.latitude},${coordinate.longitude}`,
    name,
    description,
    address,
    category,
    coordinate,
    photoUrl: buildVenuePhotoUrl(coordinate, name),
    mapboxFeatureId: feature.id ?? null,
  };
}

export async function fetchVenueAtCoordinate(
  coordinate: GeoCoordinate,
  hintName?: string,
): Promise<HangoutVenue | null> {
  const accessToken = token();
  if (!accessToken) return null;

  const { longitude, latitude } = coordinate;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("types", "poi,address,place");
  url.searchParams.set("limit", "5");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = (await response.json()) as MapboxGeocodeResponse;
    const features = data.features ?? [];

    const poiFeature =
      features.find((feature) => feature.place_type?.includes("poi")) ??
      features.find((feature) =>
        hintName ? feature.text?.toLowerCase() === hintName.toLowerCase() : false,
      ) ??
      features[0];

    if (!poiFeature) return null;

    return featureToVenue(poiFeature, coordinate);
  } catch {
    return null;
  }
}

export function buildFallbackVenue(
  coordinate: GeoCoordinate,
  name = "Selected location",
): HangoutVenue {
  return {
    id: `${coordinate.latitude},${coordinate.longitude}`,
    name,
    description: `Meet up at ${name}.`,
    address: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
    category: null,
    coordinate,
    photoUrl: buildVenuePhotoUrl(coordinate, name),
    mapboxFeatureId: null,
  };
}

export function pickPoiFromMapFeatures(
  features: Array<{
    id?: string | number;
    layer?: { id?: string; type?: string };
    properties?: Record<string, unknown>;
  }>,
  coordinate: GeoCoordinate,
): HangoutVenue | null {
  const poiFeature = features.find((feature) => {
    const layerId = feature.layer?.id ?? "";
    const hasName = Boolean(feature.properties?.name || feature.properties?.name_en);
    return hasName && (layerId.includes("poi") || layerId.includes("label") || feature.layer?.type === "symbol");
  });

  if (!poiFeature) return null;

  const name = String(poiFeature.properties?.name ?? poiFeature.properties?.name_en ?? "Venue");
  const address =
    String(poiFeature.properties?.address ?? "") ||
    `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
  const category = poiFeature.properties?.category
    ? String(poiFeature.properties.category)
    : poiFeature.properties?.class
      ? String(poiFeature.properties.class)
      : null;

  return {
    id: String(poiFeature.id ?? `${coordinate.latitude},${coordinate.longitude}`),
    name,
    description: category
      ? `${name} — ${category.replace(/_/g, " ")}`
      : `Offline hangout at ${name}.`,
    address,
    category,
    coordinate,
    photoUrl: buildVenuePhotoUrl(coordinate, name),
    mapboxFeatureId: poiFeature.id != null ? String(poiFeature.id) : null,
  };
}
