import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Sparkle } from "lucide-react";
import { toast } from "sonner";
import {
  parseStorageUploadError,
  resetPostAttachmentsBucketCache,
} from "@/lib/supabase-storage-bucket";
import {
  AttachmentPreviewRow,
  type AttachmentPreviewItem,
} from "@/components/hope-feed/AttachmentPreviewRow";
import { HopeProductSuggestionWidget } from "@/components/hope-feed/HopeProductSuggestionWidget";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  HOPE_ATTACHMENT_ACCEPT,
  classifyHopeAttachment,
  validateHopeAttachmentFile,
} from "@/lib/hope-attachment-utils";
import { extractShoppingQuery } from "@/lib/hope-shopping-intent";
import { searchMarketplaceProducts } from "@/lib/product-semantic-search";
import { extractMarketplaceLinks, extractShopProductSkus } from "@/lib/shop-link-parser";
import { cn } from "@/lib/utils";
import { uploadHopePostAttachment } from "@/services/hope-post-attachments";
import type { HopePostAttachment } from "@/types/hope-post";
import type { ErpInventoryItem } from "@/types/erp";

interface HopePostComposerProps {
  userId: string | null;
  isAuthenticated: boolean;
  isPosting: boolean;
  catalog: ErpInventoryItem[];
  catalogLoading?: boolean;
  onRequireAuth: () => void;
  onSubmit: (input: {
    content: string;
    attachments: HopePostAttachment[];
    marketplace_link: string | null;
    marketplace_links: string[];
  }) => Promise<void>;
}

interface QueuedAttachment {
  id: string;
  file: File;
  previewUrl: string;
  preview: AttachmentPreviewItem;
  uploaded?: HopePostAttachment;
}

const UPLOAD_CONCURRENCY = 4;

export function HopePostComposer({
  userId,
  isAuthenticated,
  isPosting,
  catalog,
  catalogLoading = false,
  onRequireAuth,
  onSubmit,
}: HopePostComposerProps) {
  const [draft, setDraft] = useState("");
  const [queue, setQueue] = useState<QueuedAttachment[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadWaitlistRef = useRef<QueuedAttachment[]>([]);
  const activeUploadsRef = useRef(0);

  const debouncedDraft = useDebouncedValue(draft, 400);
  const shoppingQuery = useMemo(() => extractShoppingQuery(debouncedDraft), [debouncedDraft]);
  const isDebouncing = draft.trim() !== debouncedDraft.trim();

  const suggestions = useMemo(() => {
    if (!shoppingQuery) return [];
    return searchMarketplaceProducts(catalog, shoppingQuery, 10);
  }, [catalog, shoppingQuery]);

  const attachedSkus = useMemo(() => new Set(extractShopProductSkus(draft)), [draft]);

  const showSuggestions = Boolean(debouncedDraft.trim() && shoppingQuery);

  useEffect(() => {
    if (!shoppingQuery) {
      setMatchLoading(false);
      return;
    }

    setMatchLoading(true);
    const timer = window.setTimeout(() => setMatchLoading(false), catalogLoading ? 400 : 180);
    return () => window.clearTimeout(timer);
  }, [catalogLoading, shoppingQuery, debouncedDraft]);

  const suggestionsLoading = showSuggestions && (isDebouncing || matchLoading || catalogLoading);

  const attachProduct = useCallback((product: ErpInventoryItem) => {
    const link = `/shop?tab=shopping&sku=${encodeURIComponent(product.pivoton_sku)}`;
    setDraft((prev) => {
      if (extractShopProductSkus(prev).includes(product.pivoton_sku)) return prev;
      const base = prev.trim();
      return base ? `${base}\n\n${link}` : link;
    });
    toast.success(`Attached ${product.title} to your post`);
  }, []);

  const previewItems = queue.map((item) => item.preview);
  const hasUploading = queue.some((item) => item.preview.status === "uploading");
  const readyAttachments = queue
    .filter((item) => item.uploaded && item.preview.status === "ready")
    .map((item) => item.uploaded!);

  const canPost =
    (draft.trim().length > 0 || readyAttachments.length > 0) &&
    !isPosting &&
    !hasUploading;

  const revokeQueueItem = useCallback((item: QueuedAttachment) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue((prev) => {
      prev.forEach(revokeQueueItem);
      return [];
    });
  }, [revokeQueueItem]);

  const removeQueuedItem = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) revokeQueueItem(target);
        return prev.filter((item) => item.id !== id);
      });
    },
    [revokeQueueItem],
  );

  const notifyBucketSetupError = useCallback((message: string) => {
    resetPostAttachmentsBucketCache();
    toast.error("Storage bucket not configured", {
      description: message,
      duration: 8_000,
    });
  }, []);

  const updatePreview = useCallback((id: string, patch: Partial<AttachmentPreviewItem>) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, preview: { ...item.preview, ...patch } } : item,
      ),
    );
  }, []);

  const uploadFile = useCallback(
    async (queued: QueuedAttachment) => {
      if (!userId) {
        removeQueuedItem(queued.id);
        onRequireAuth();
        return;
      }

      try {
        const uploaded = await uploadHopePostAttachment(queued.file, userId);
        const usedInline = uploaded.url.startsWith("data:");

        setQueue((prev) =>
          prev.map((item) =>
            item.id === queued.id
              ? { ...item, uploaded, preview: { ...item.preview, status: "ready" } }
              : item,
          ),
        );

        if (usedInline) {
          toast.message("Attached inline", {
            description: "Storage bucket unavailable — file saved with your post for now.",
            duration: 5_000,
          });
        }
      } catch (error) {
        const parsed = parseStorageUploadError(error);

        if (parsed.isBucketError) {
          notifyBucketSetupError(parsed.message);
          removeQueuedItem(queued.id);
          return;
        }

        updatePreview(queued.id, { status: "error", error: parsed.message });

        if (parsed.isPolicyError) {
          toast.error(`Upload blocked for ${queued.file.name}`, {
            description: "Check Supabase Storage RLS policies for post-attachments.",
          });
          window.setTimeout(() => removeQueuedItem(queued.id), 3_000);
          return;
        }

        toast.error(`Could not upload ${queued.file.name}`, { description: parsed.message });
        window.setTimeout(() => removeQueuedItem(queued.id), 4_000);
      }
    },
    [notifyBucketSetupError, onRequireAuth, removeQueuedItem, updatePreview, userId],
  );

  const pumpUploads = useCallback(() => {
    while (
      activeUploadsRef.current < UPLOAD_CONCURRENCY &&
      uploadWaitlistRef.current.length > 0
    ) {
      const next = uploadWaitlistRef.current.shift()!;
      activeUploadsRef.current += 1;
      void uploadFile(next).finally(() => {
        activeUploadsRef.current -= 1;
        pumpUploads();
      });
    }
  }, [uploadFile]);

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      if (!isAuthenticated) {
        onRequireAuth();
        return;
      }

      if (!userId) {
        onRequireAuth();
        return;
      }

      const selected = Array.from(files);

      for (const file of selected) {
        const validation = validateHopeAttachmentFile(file);
        if (!validation.ok) {
          toast.error(validation.message);
          continue;
        }

        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const previewUrl = URL.createObjectURL(file);
        const queued: QueuedAttachment = {
          id,
          file,
          previewUrl,
          preview: {
            id,
            file_name: file.name,
            file_type: classifyHopeAttachment(file),
            previewUrl,
            status: "uploading",
          },
        };

        setQueue((prev) => [...prev, queued]);
        uploadWaitlistRef.current.push(queued);
        pumpUploads();
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [isAuthenticated, onRequireAuth, pumpUploads, userId],
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeQueuedItem(id);
    },
    [removeQueuedItem],
  );

  const handlePost = async () => {
    const content = draft.trim();
    if (!content && readyAttachments.length === 0) return;

    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    if (hasUploading) {
      toast.error("Wait for attachments to finish uploading.");
      return;
    }

    const marketplace_links = extractMarketplaceLinks(content);
    const marketplace_link = marketplace_links[0] ?? null;

    try {
      await onSubmit({
        content,
        attachments: readyAttachments,
        marketplace_link,
        marketplace_links,
      });

      clearQueue();
      setDraft("");
    } catch {
      // Parent handles toast
    }
  };

  return (
    <div className="panel mt-10 p-6">
      <div className="relative">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="I hope…"
          className={cn(
            "min-h-28 resize-none border-0 bg-transparent p-0 pr-1 shadow-none focus-visible:ring-0",
            showSuggestions && "sm:min-h-32 sm:pb-[11rem] sm:pr-[13rem]",
          )}
        />

        <HopeProductSuggestionWidget
          visible={showSuggestions}
          loading={suggestionsLoading}
          query={shoppingQuery}
          products={suggestions}
          attachedSkus={attachedSkus}
          onAttach={attachProduct}
          className="absolute bottom-1 right-0 z-10 w-full sm:w-[min(100%,13rem)]"
        />
      </div>

      <AttachmentPreviewRow items={previewItems} onRemove={handleRemove} />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={HOPE_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFilesSelected(event.target.files)}
      />

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPosting}
            title="Attach images, videos, or documents"
          >
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            Attach
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast("AI composer is a Premium feature")}
          >
            <Sparkle className="mr-1.5 h-3.5 w-3.5" /> Compose with AI
          </Button>
        </div>
        <Button size="sm" disabled={!canPost} onClick={() => void handlePost()}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> {isPosting ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
