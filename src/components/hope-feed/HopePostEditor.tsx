import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { HopeProductSuggestionWidget } from "@/components/hope-feed/HopeProductSuggestionWidget";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  HOPE_ATTACHMENT_ACCEPT,
  resolveHopePostAttachments,
  validateHopeAttachmentFile,
} from "@/lib/hope-attachment-utils";
import { extractShoppingQuery } from "@/lib/hope-shopping-intent";
import { searchMarketplaceProducts } from "@/lib/product-semantic-search";
import { extractMarketplaceLinks, extractShopProductSkus } from "@/lib/shop-link-parser";
import { cn } from "@/lib/utils";
import { uploadHopePostAttachments } from "@/services/hope-post-attachments";
import type { ErpInventoryItem } from "@/types/erp";
import type { HopePost, HopePostAttachment } from "@/types/hope-post";

interface HopePostEditorProps {
  post: HopePost;
  catalog: ErpInventoryItem[];
  catalogLoading?: boolean;
  userId: string;
  onSave: (input: {
    content: string;
    attachments: HopePostAttachment[];
    marketplace_link: string | null;
    marketplace_links: string[];
    attachmentsTouched: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export function HopePostEditor({
  post,
  catalog,
  catalogLoading = false,
  userId,
  onSave,
  onCancel,
}: HopePostEditorProps) {
  const [draft, setDraft] = useState(post.content);
  const [attachments, setAttachments] = useState<HopePostAttachment[]>(() =>
    resolveHopePostAttachments(post),
  );
  const [attachmentsTouched, setAttachmentsTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedDraft = useDebouncedValue(draft, 400);
  const shoppingQuery = useMemo(() => extractShoppingQuery(debouncedDraft), [debouncedDraft]);
  const suggestions = useMemo(() => {
    if (!shoppingQuery) return [];
    return searchMarketplaceProducts(catalog, shoppingQuery, 8);
  }, [catalog, shoppingQuery]);
  const attachedSkus = useMemo(() => new Set(extractShopProductSkus(draft)), [draft]);
  const showSuggestions = Boolean(debouncedDraft.trim() && shoppingQuery);

  const removeAttachment = useCallback((index: number) => {
    setAttachmentsTouched(true);
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const attachProduct = useCallback((product: ErpInventoryItem) => {
    const link = `/shop?tab=shopping&sku=${encodeURIComponent(product.pivoton_sku)}`;
    setDraft((prev) => {
      if (extractShopProductSkus(prev).includes(product.pivoton_sku)) return prev;
      const base = prev.trim();
      return base ? `${base}\n\n${link}` : link;
    });
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      if (!userId) {
        toast.error("Sign in to add attachments.");
        return;
      }

      const validFiles: File[] = [];

      for (const file of Array.from(files)) {
        const validation = validateHopeAttachmentFile(file);
        if (!validation.ok) {
          toast.error(validation.message);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploadingCount((count) => count + validFiles.length);

      try {
        const uploaded = await uploadHopePostAttachments(validFiles, userId);
        setAttachmentsTouched(true);
        setAttachments((prev) => [...prev, ...uploaded]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error("Could not upload attachments", { description: message });
      } finally {
        setUploadingCount((count) => Math.max(0, count - validFiles.length));
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [userId],
  );

  const handleSave = async () => {
    const content = draft.trim();
    if (!content && attachments.length === 0) {
      toast.error("Add text or at least one attachment.");
      return;
    }

    if (uploadingCount > 0) {
      toast.error("Wait for attachments to finish uploading.");
      return;
    }

    setIsSaving(true);
    try {
      const marketplace_links = extractMarketplaceLinks(content);
      const marketplace_link = marketplace_links[0] ?? null;

      await onSave({ content, attachments, marketplace_link, marketplace_links, attachmentsTouched });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="relative">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className={cn(
            "min-h-28 resize-none bg-surface-2/40",
            showSuggestions && "sm:min-h-32 sm:pb-[11rem] sm:pr-[13rem]",
          )}
        />

        <HopeProductSuggestionWidget
          visible={showSuggestions}
          loading={catalogLoading || debouncedDraft !== draft}
          query={shoppingQuery}
          products={suggestions}
          attachedSkus={attachedSkus}
          onAttach={attachProduct}
          className="absolute bottom-2 right-2 z-10 w-full sm:w-[min(100%,13rem)]"
        />
      </div>

      {(attachments.length > 0 || uploadingCount > 0) && (
        <div className="custom-scrollbar flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.url}-${index}`}
              className="group relative h-[52px] w-[52px] overflow-hidden rounded-md border border-border/60"
            >
              {attachment.file_type === "image" ? (
                <img src={attachment.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-surface-2 text-[9px] text-muted-foreground">
                  {attachment.file_name.split(".").pop()?.toUpperCase()}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-[#0B132B] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Remove ${attachment.file_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {uploadingCount > 0 && (
            <span className="grid h-[52px] w-[52px] place-items-center rounded-md border border-border/60 bg-surface-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </span>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={HOPE_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFilesSelected(event.target.files)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSaving}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          Attach
        </Button>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={isSaving || uploadingCount > 0} onClick={() => void handleSave()}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
