const GRID_THUMB_WIDTH = 480;

/**
 * Prefer smaller catalog thumbnails when the upstream URL supports sizing hints.
 */
export function optimizeProductImageUrl(url: string, width = GRID_THUMB_WIDTH): string {
  if (!url) return url;

  try {
    const parsed = new URL(url, "https://placeholder.local");

    if (parsed.hostname.includes("unsplash.com")) {
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", "75");
      parsed.searchParams.set("auto", "format");
      return parsed.toString();
    }

    if (parsed.hostname.includes("cloudinary.com") && parsed.pathname.includes("/upload/")) {
      return parsed.toString().replace("/upload/", `/upload/w_${width},f_auto,q_auto/`);
    }

    if (parsed.hostname.includes("dummyjson.com") && parsed.pathname.includes("/thumbnail")) {
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
}
