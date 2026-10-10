import { useMemo } from "react";
import { FileText, Film } from "lucide-react";
import { HopeImageCarousel } from "@/components/hope-feed/HopeImageCarousel";
import { resolvePostProductSkus } from "@/lib/hope-post-marketplace";
import { imageUrlsFromAttachments, resolveHopePostAttachments } from "@/lib/hope-attachment-utils";
import { stripShopUrlsFromContent } from "@/lib/shop-link-parser";
import type { ErpInventoryItem } from "@/types/erp";
import type { HopePost, HopePostAttachment } from "@/types/hope-post";

interface HopePostMediaRowProps {
  attachments?: HopePostAttachment[];
  imageUrls?: string[];
}

export function resolveHopePostCatalogProducts(
  fields: Pick<HopePost, "content" | "marketplace_link" | "marketplace_links">,
  catalog: ErpInventoryItem[],
): ErpInventoryItem[] {
  const productSkus = resolvePostProductSkus(fields);
  return productSkus
    .map((sku) => {
      const normalized = sku.toLowerCase();
      return catalog.find(
        (item) =>
          item.pivoton_sku.toLowerCase() === normalized ||
          item.pivoton_sku.toLowerCase().endsWith(`-${normalized}`) ||
          item.pivoton_sku.toLowerCase().includes(normalized),
      );
    })
    .filter((item): item is ErpInventoryItem => Boolean(item));
}

function CompactVideoThumb({ attachment }: { attachment: HopePostAttachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md border border-border/60 bg-surface-2"
      title={attachment.file_name}
    >
      <video src={attachment.url} muted className="h-full w-full object-cover" />
      <Film className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
    </a>
  );
}

function CompactDocumentBadge({ attachment }: { attachment: HopePostAttachment }) {
  const ext = attachment.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[52px] min-w-[72px] max-w-[100px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-surface-2 px-1.5"
      title={attachment.file_name}
    >
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="line-clamp-1 text-[8px] font-medium uppercase text-muted-foreground">{ext}</span>
    </a>
  );
}

export function HopePostMediaRow({ attachments = [], imageUrls }: HopePostMediaRowProps) {
  const resolvedAttachments = useMemo(
    () => resolveHopePostAttachments({ attachments, image_urls: imageUrls }),
    [attachments, imageUrls],
  );

  const images = useMemo(() => imageUrlsFromAttachments(resolvedAttachments), [resolvedAttachments]);

  const videos = resolvedAttachments.filter((a) => a.file_type === "video");
  const documents = resolvedAttachments.filter((a) => a.file_type === "document");
  const hasMedia = images.length > 0 || videos.length > 0 || documents.length > 0;

  if (!hasMedia) return null;

  return (
    <div className="mt-3">
      {images.length > 0 && (
        <div className="min-w-0 w-full max-w-full overflow-hidden">
          <HopeImageCarousel images={images} />
        </div>
      )}
      {(videos.length > 0 || documents.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {videos.map((attachment) => (
            <CompactVideoThumb key={attachment.url} attachment={attachment} />
          ))}
          {documents.map((attachment) => (
            <CompactDocumentBadge key={attachment.url} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}

export function renderHopePostText(content: string): string {
  return stripShopUrlsFromContent(content);
}

export function hopePostMediaProps(post: Pick<HopePost, "attachments" | "image_urls">) {
  return {
    attachments: post.attachments,
    imageUrls: post.image_urls,
  };
}
