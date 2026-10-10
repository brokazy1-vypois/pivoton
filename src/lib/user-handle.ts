export function deriveUserHandle(fullName: string, userId: string): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (slug.length > 0) return `@${slug}`;
  return `@${userId.slice(0, 8)}`;
}

export function formatJoinDate(iso: string | null): string {
  if (!iso) return "Recently joined";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
