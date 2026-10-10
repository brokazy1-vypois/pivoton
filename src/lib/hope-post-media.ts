import type { HopePost, HopePostAttachment } from "@/types/hope-post";

/** Static media enrichments for seed hope posts (images + marketplace links in copy). */
export const HOPE_POST_MEDIA: Record<
  string,
  { image_urls?: string[]; shopSku?: string }
> = {
  "seed-p-001": {
    image_urls: [
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=240&h=240&fit=crop",
      "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=240&h=240&fit=crop",
      "https://images.unsplash.com/photo-1559757143-5c350d0d3c56?w=240&h=240&fit=crop",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=240&h=240&fit=crop",
    ],
    shopSku: "1",
  },
  "seed-p-006": {
    image_urls: [
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=240&h=240&fit=crop",
      "https://images.unsplash.com/photo-1642790106117-e829e014a895?w=240&h=240&fit=crop",
    ],
  },
  "seed-p-010": {
    image_urls: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=240&h=240&fit=crop",
    ],
    shopSku: "2",
  },
};

export function enrichHopePostWithMedia(post: HopePost): HopePost {
  const media = HOPE_POST_MEDIA[post.id];
  if (!media) return post;

  let content = post.content;
  let marketplace_link = post.marketplace_link ?? null;
  let marketplace_links = post.marketplace_links ?? [];

  if (media.shopSku && !content.includes("/shop")) {
    const link = `/shop?tab=shopping&sku=${media.shopSku}`;
    content = `${content}\n\nCheck this for the clinic restock: ${link}`;
    marketplace_link = link;
    marketplace_links = [link];
  }

  const seedImages = post.image_urls?.length ? post.image_urls : media.image_urls;
  const attachments: HopePostAttachment[] =
    post.attachments?.length
      ? post.attachments
      : (seedImages ?? []).map((url, index) => ({
          url,
          file_type: "image" as const,
          file_name: `seed-image-${index + 1}.jpg`,
        }));

  return {
    ...post,
    content,
    marketplace_link,
    marketplace_links: marketplace_links.length > 0 ? marketplace_links : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    image_urls: seedImages,
  };
}

export function enrichHopePostsWithMedia(posts: HopePost[]): HopePost[] {
  return posts.map(enrichHopePostWithMedia);
}
