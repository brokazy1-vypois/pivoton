import { forwardRef, useMemo, useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HopeAttachedProductsWidget } from "@/components/hope-feed/HopeAttachedProductsWidget";
import { HopeCommentThread } from "@/components/hope-feed/HopeCommentThread";
import { GoalTrackButton } from "@/components/hope-feed/GoalTrackButton";
import { HopePostEditor } from "@/components/hope-feed/HopePostEditor";
import {
  HopePostMediaRow,
  renderHopePostText,
  resolveHopePostCatalogProducts,
} from "@/components/hope-feed/HopePostMediaRow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserProfileLink } from "@/components/hope-feed/UserProfileLink";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { cn } from "@/lib/utils";
import { deleteHopePost, updateHopePost } from "@/services/hope-posts";
import type { HopeComment, HopePost, HopePostAttachment } from "@/types/hope-post";
import type { GoalWithDetails } from "@/types/hope-goal";
import type { ErpInventoryItem } from "@/types/erp";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface HopePostCardProps {
  post: HopePost;
  catalog: ErpInventoryItem[];
  catalogLoading?: boolean;
  comments: HopeComment[];
  isActive: boolean;
  isFocused?: boolean;
  currentUserId?: string | null;
  onPostUpdated: (post: HopePost) => void;
  onPostDeleted: (postId: string) => void;
  onThreadLayoutChange: () => void;
  onCommentAdded: (comment: HopeComment) => void;
  onCommentReplaced: (tempId: string, saved: HopeComment) => void;
  onCommentRemoved: (tempId: string) => void;
  goalForPost?: GoalWithDetails | null;
  initialGoalTracked?: boolean;
  skipGoalLookup?: boolean;
  onGoalConverted?: (goal: GoalWithDetails) => void;
}

export const HopePostCard = forwardRef<HTMLElement, HopePostCardProps>(function HopePostCard(
  {
    post,
    catalog,
    catalogLoading,
    comments,
    isActive,
    isFocused = false,
    currentUserId,
    onPostUpdated,
    onPostDeleted,
    onThreadLayoutChange,
    onCommentAdded,
    onCommentReplaced,
    onCommentRemoved,
    goalForPost,
    initialGoalTracked,
    skipGoalLookup,
    onGoalConverted,
  },
  ref,
) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = Boolean(currentUserId && currentUserId === post.user_id);
  const avatar =
    post.author_avatar ??
    post.author_name
      .split(" ")
      .map((n) => n[0])
      .join("");

  const replyCount = comments.length;

  const attachedProducts = useMemo(
    () =>
      resolveHopePostCatalogProducts(
        {
          content: post.content,
          marketplace_link: post.marketplace_link,
          marketplace_links: post.marketplace_links,
        },
        catalog,
      ),
    [post.content, post.marketplace_link, post.marketplace_links, catalog],
  );
  const hasAttachedProducts = attachedProducts.length > 0;

  const handleSave = async (input: {
    content: string;
    attachments: HopePostAttachment[];
    marketplace_link: string | null;
    marketplace_links: string[];
    attachmentsTouched: boolean;
  }) => {
    if (!currentUserId) return;

    try {
      const updated = await updateHopePost(post.id, currentUserId, {
        ...input,
        existingPost: post,
      });
      onPostUpdated(updated);
      setIsEditing(false);
      toast.success("Post updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update failed";
      toast.error("Could not save changes", { description: message });
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!currentUserId) return;

    setIsDeleting(true);
    try {
      await deleteHopePost(post.id, currentUserId);
      onPostDeleted(post.id);
      setDeleteOpen(false);
      toast.success("Post deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      toast.error("Could not delete post", { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <article
        ref={ref}
        id={`post-${post.id}`}
        data-post-id={post.id}
        data-user-id={post.user_id}
        className={cn(
          "panel relative overflow-hidden scroll-mt-28 p-7 transition-all duration-300",
          isActive && "ring-1 ring-primary/30",
          isFocused && "ring-2 ring-primary/70 shadow-lg shadow-primary/10",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UserProfileLink userId={post.user_id} className="hover:text-inherit">
              <UserAvatar userId={post.user_id} initials={avatar} className="h-8 w-8 text-xs" />
            </UserProfileLink>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <UserProfileLink userId={post.user_id} className="text-sm font-medium">
                  {post.author_name}
                </UserProfileLink>
                {post.job_role && (
                  <Badge variant="secondary" className="text-[10px]">
                    {post.job_role}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formatTimeAgo(post.created_at)} ago
                {post.edited_at ? <span className="text-muted-foreground/80"> · edited</span> : null}
              </p>
            </div>
          </div>

          {isAuthor && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  aria-label="Post options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-bear focus:text-bear"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing && currentUserId ? (
          <HopePostEditor
            post={post}
            catalog={catalog}
            catalogLoading={catalogLoading}
            userId={currentUserId}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div
            className={cn(
              "mt-4 flex w-full flex-col items-start justify-between gap-4",
              hasAttachedProducts && "sm:flex-row",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-relaxed">{renderHopePostText(post.content)}</p>
              <HopePostMediaRow attachments={post.attachments} imageUrls={post.image_urls} />
            </div>
            {hasAttachedProducts && (
              <HopeAttachedProductsWidget products={attachedProducts} />
            )}
          </div>
        )}

        {!isEditing && (
          <div
            className="mt-5 flex flex-wrap items-center gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Heart className="mr-1.5 h-3.5 w-3.5" /> {post.likes_count}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              {replyCount > 0 ? `${replyCount} replies` : "Reply"}
            </Button>
            <GoalTrackButton
              post={post}
              currentUserId={currentUserId}
              attachedProductNames={attachedProducts.map((product) => product.title)}
              initialIsTracked={Boolean(goalForPost ?? initialGoalTracked)}
              skipGoalLookup={skipGoalLookup}
              {...(onGoalConverted ? { onConverted: onGoalConverted } : {})}
            />
          </div>
        )}

        <HopeCommentThread
          postId={post.id}
          comments={comments}
          onCommentAdded={onCommentAdded}
          onCommentReplaced={onCommentReplaced}
          onCommentRemoved={onCommentRemoved}
          onLayoutChange={onThreadLayoutChange}
        />
      </article>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hope?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post and its attachments from your feed. Replies will remain unless
              you delete them separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-bear text-white hover:bg-bear/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting…" : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
