import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  buildCommentTree,
  countTreeNodes,
  maxTreeDepth,
  trimTreeForCollapsed,
} from "@/lib/comment-tree";
import { UserProfileLink } from "@/components/hope-feed/UserProfileLink";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { createHopeComment } from "@/services/hope-posts";
import type { CommentNode, HopeComment } from "@/types/hope-post";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface CommentInputFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  autoFocus?: boolean;
}

function CommentInputForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  onFocus,
  placeholder = "Write a reply…",
  submitLabel = "Reply",
  isSubmitting = false,
  autoFocus = false,
}: CommentInputFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="flex gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={2}
        className={cn(
          "min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2 text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30",
        )}
      />
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          size="sm"
          disabled={!value.trim() || isSubmitting}
          onClick={onSubmit}
          className="h-8"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="mr-1 h-3 w-3" />
              {submitLabel}
            </>
          )}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function CommentHead({ node }: { node: CommentNode }) {
  const avatar =
    node.author_avatar ??
    node.author_name
      .split(" ")
      .map((n) => n[0])
      .join("");

  return (
    <div className="flex items-center gap-2">
      <UserProfileLink userId={node.user_id} className="hover:text-inherit">
        <UserAvatar userId={node.user_id} initials={avatar} className="h-7 w-7 text-[10px]" />
      </UserProfileLink>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <UserProfileLink userId={node.user_id} className="text-xs font-medium">
            {node.author_name}
          </UserProfileLink>
          {node.job_role && (
            <Badge variant="secondary" className="text-[9px]">
              {node.job_role}
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatTimeAgo(node.created_at)} ago
        </span>
      </div>
    </div>
  );
}

interface CommentBranchProps {
  nodes: CommentNode[];
  depth?: number;
  replyingToId: string | null;
  replyDraft: string;
  isSubmitting: boolean;
  onReplyClick: (node: CommentNode) => void;
  onReplyDraftChange: (value: string) => void;
  onReplySubmit: (parentId: string, replyToName: string) => void;
  onReplyCancel: () => void;
}

function CommentBranch({
  nodes,
  depth = 0,
  replyingToId,
  replyDraft,
  isSubmitting,
  onReplyClick,
  onReplyDraftChange,
  onReplySubmit,
  onReplyCancel,
}: CommentBranchProps) {
  if (nodes.length === 0) return null;

  return (
    <ul className={cn("relative space-y-4", depth > 0 && "mt-4 border-l border-slate-700/60 pl-4 ml-2")}>
      {nodes.map((node, i) => (
        <li key={node.id} className="relative">
          {depth > 0 && (
            <>
              <span className="absolute top-3.5 -left-[18px] h-px w-[18px] border-t border-slate-700/60" aria-hidden />
              {i === nodes.length - 1 && replyingToId !== node.id && (
                <span
                  className="absolute top-3.5 -left-[18px] bottom-[-1rem] w-px bg-surface"
                  aria-hidden
                />
              )}
              <span
                className="absolute top-[11px] -left-[22px] h-1.5 w-1.5 rounded-full bg-primary/80"
                aria-hidden
              />
            </>
          )}
          <div className="rounded-lg border border-border/60 bg-surface-2/50 p-3.5">
            <CommentHead node={node} />
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{node.content}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onReplyClick(node)}
            >
              <MessageCircle className="mr-1 h-3 w-3" />
              Reply
            </Button>
          </div>

          {replyingToId === node.id && (
            <div className="mt-3 border-l border-slate-700/60 pl-4 ml-2">
              <CommentInputForm
                value={replyDraft}
                onChange={onReplyDraftChange}
                onSubmit={() => onReplySubmit(node.id, node.author_name)}
                onCancel={onReplyCancel}
                placeholder={`Reply to @${node.author_name}…`}
                submitLabel="Reply"
                isSubmitting={isSubmitting}
                autoFocus
              />
            </div>
          )}

          {node.children.length > 0 && (
            <CommentBranch
              nodes={node.children}
              depth={depth + 1}
              replyingToId={replyingToId}
              replyDraft={replyDraft}
              isSubmitting={isSubmitting}
              onReplyClick={onReplyClick}
              onReplyDraftChange={onReplyDraftChange}
              onReplySubmit={onReplySubmit}
              onReplyCancel={onReplyCancel}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

interface HopeCommentThreadProps {
  postId: string;
  comments: HopeComment[];
  onCommentAdded: (comment: HopeComment) => void;
  onCommentReplaced: (tempId: string, saved: HopeComment) => void;
  onCommentRemoved: (tempId: string) => void;
  onLayoutChange?: () => void;
}

export function HopeCommentThread({
  postId,
  comments,
  onCommentAdded,
  onCommentReplaced,
  onCommentRemoved,
  onLayoutChange,
}: HopeCommentThreadProps) {
  const { user, openAuthModal } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [rootDraft, setRootDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requireAuth = useCallback((): boolean => {
    if (!user) {
      openAuthModal("Please sign in to join the conversation.");
      return false;
    }
    return true;
  }, [user, openAuthModal]);

  const notifyLayout = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => onLayoutChange?.());
    });
  }, [onLayoutChange]);

  const submitComment = useCallback(
    async (rawContent: string, parentId: string | null) => {
      if (!requireAuth()) return;

      const content = rawContent.trim();
      if (!content) return;

      const tempId = `temp-c-${Date.now()}`;
      const optimistic: HopeComment = {
        id: tempId,
        post_id: postId,
        parent_id: parentId,
        user_id: user!.id,
        author_name: user!.fullName,
        author_avatar: user!.avatar,
        job_role: user!.role ?? null,
        content,
        created_at: new Date().toISOString(),
      };

      setExpanded(true);
      onCommentAdded(optimistic);
      setRootDraft("");
      setReplyDraft("");
      setReplyingToId(null);
      notifyLayout();

      setIsSubmitting(true);
      try {
        const saved = await createHopeComment({
          post_id: postId,
          parent_id: parentId,
          user_id: user!.id,
          author_name: user!.fullName,
          author_avatar: user!.avatar,
          job_role: user!.role ?? null,
          content,
        });
        onCommentReplaced(tempId, saved);
      } catch {
        onCommentRemoved(tempId);
        toast.error("Failed to post reply — try again");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      requireAuth,
      postId,
      user,
      onCommentAdded,
      onCommentReplaced,
      onCommentRemoved,
      notifyLayout,
    ],
  );

  const handleRootSubmit = () => {
    if (!requireAuth()) return;
    void submitComment(rootDraft, null);
  };

  const handleReplyClick = (node: CommentNode) => {
    if (!requireAuth()) return;
    setExpanded(true);
    setReplyingToId(node.id);
    setReplyDraft(`@${node.author_name} `);
    notifyLayout();
  };

  const handleReplySubmit = (parentId: string, _replyToName: string) => {
    void submitComment(replyDraft, parentId);
  };

  const handleReplyCancel = () => {
    setReplyingToId(null);
    setReplyDraft("");
    notifyLayout();
  };

  const fullTree = buildCommentTree(comments);
  const totalCount = countTreeNodes(fullTree);
  const depth = maxTreeDepth(fullTree);
  const collapsedTree = trimTreeForCollapsed(fullTree);
  const collapsedCount = countTreeNodes(collapsedTree);
  const hiddenCount = totalCount - collapsedCount;
  const needsCollapse = hiddenCount > 0;
  const displayTree = expanded || !needsCollapse ? fullTree : collapsedTree;

  const handleToggle = () => {
    setExpanded((v) => !v);
    notifyLayout();
  };

  return (
    <div className="mt-6 border-t border-border pt-6 transition-all duration-300">
      {comments.length > 0 && (
        <>
          <CommentBranch
            nodes={displayTree}
            replyingToId={replyingToId}
            replyDraft={replyDraft}
            isSubmitting={isSubmitting}
            onReplyClick={handleReplyClick}
            onReplyDraftChange={setReplyDraft}
            onReplySubmit={handleReplySubmit}
            onReplyCancel={handleReplyCancel}
          />

          {needsCollapse && (
            <div className="mt-4 flex items-center gap-2">
              {!expanded ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleToggle}
                >
                  <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  View {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
                  {depth > 2 && ` · ${depth} levels deep`}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleToggle}
                >
                  <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                  Collapse thread
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <div className={cn(comments.length > 0 && "mt-5")}>
        <CommentInputForm
          value={rootDraft}
          onChange={setRootDraft}
          onSubmit={handleRootSubmit}
          onFocus={() => requireAuth()}
          placeholder="Write a reply…"
          submitLabel="Reply"
          isSubmitting={isSubmitting && !replyingToId}
        />
        {!user && (
          <button
            type="button"
            className="mt-2 w-full text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => requireAuth()}
          >
            Sign in to comment
          </button>
        )}
      </div>
    </div>
  );
}
