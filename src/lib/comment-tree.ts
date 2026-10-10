import type { CommentNode, HopeComment } from "@/types/hope-post";

export const COLLAPSED_ROOT_LIMIT = 2;
export const COLLAPSED_CHILD_LIMIT = 1;

export function buildCommentTree(comments: HopeComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();

  for (const comment of comments) {
    map.set(comment.id, { ...comment, children: [] });
  }

  const roots: CommentNode[] = [];

  for (const comment of comments) {
    const node = map.get(comment.id)!;
    if (comment.parent_id && map.has(comment.parent_id)) {
      map.get(comment.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const node of nodes) sortNodes(node.children);
  };

  sortNodes(roots);
  return roots;
}

export function countTreeNodes(nodes: CommentNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children), 0);
}

export function maxTreeDepth(nodes: CommentNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(
    ...nodes.map((node) =>
      node.children.length > 0 ? 1 + maxTreeDepth(node.children) : 1,
    ),
  );
}

/** Collapsed view: top 2 roots, max 1 child each, no deeper nesting. */
export function trimTreeForCollapsed(nodes: CommentNode[]): CommentNode[] {
  return nodes.slice(0, COLLAPSED_ROOT_LIMIT).map((root) => ({
    ...root,
    children: root.children.slice(0, COLLAPSED_CHILD_LIMIT).map((child) => ({
      ...child,
      children: [],
    })),
  }));
}

export function groupCommentsByPost(
  comments: HopeComment[],
): Record<string, HopeComment[]> {
  const grouped: Record<string, HopeComment[]> = {};
  for (const comment of comments) {
    if (!grouped[comment.post_id]) grouped[comment.post_id] = [];
    grouped[comment.post_id].push(comment);
  }
  return grouped;
}
