/** Deepgram expects a simple Content-Type without codec suffixes. */
export function deepgramContentType(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "audio/webm";
  if (base.includes("webm")) return "audio/webm";
  if (base.includes("ogg")) return "audio/ogg";
  if (base.includes("mp4") || base.includes("m4a")) return "audio/mp4";
  if (base.includes("wav")) return "audio/wav";
  return base;
}
