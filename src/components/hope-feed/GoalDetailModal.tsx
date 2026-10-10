import { useMemo } from "react";
import { Calendar, CheckCircle2, ImageIcon, Target } from "lucide-react";
import { HopeAttachedProductsWidget } from "@/components/hope-feed/HopeAttachedProductsWidget";
import {
  HopePostMediaRow,
  renderHopePostText,
  resolveHopePostCatalogProducts,
} from "@/components/hope-feed/HopePostMediaRow";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GoalWithDetails } from "@/types/hope-goal";
import type { ErpInventoryItem } from "@/types/erp";

interface GoalDetailModalProps {
  goal: GoalWithDetails | null;
  catalog: ErpInventoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function GoalDetailModal({ goal, catalog, open, onOpenChange }: GoalDetailModalProps) {
  const post = goal?.post ?? null;
  const completedCount = goal?.milestones.filter((m) => m.is_completed).length ?? 0;
  const totalSteps = goal?.milestones.length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const attachedProducts = useMemo(() => {
    if (!post) return [];
    return resolveHopePostCatalogProducts(
      {
        content: post.content,
        marketplace_link: post.marketplace_link ?? null,
        marketplace_links: post.marketplace_links ?? [],
      },
      catalog,
    );
  }, [post, catalog]);

  const proofItems = useMemo(
    () =>
      (goal?.milestones ?? [])
        .filter((m) => m.proof_url)
        .sort((a, b) => a.order_index - b.order_index),
    [goal?.milestones],
  );

  const fullText = post ? renderHopePostText(post.content) : goal?.title ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto border-border/80 bg-[#0B1120]/95 backdrop-blur-sm">
        {goal && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                  <Target className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-left text-lg leading-snug">{goal.title}</DialogTitle>
                  <DialogDescription className="mt-1 text-left">
                    Full goal details from the original hope post and step progress.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  Full content
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/95">
                  {fullText || "No description available."}
                </p>
              </section>

              <section className="grid gap-3 rounded-lg border border-border/60 bg-surface-2/30 p-4 sm:grid-cols-2">
                <div className="flex gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Original hope post
                    </p>
                    <p className="text-sm">
                      {post ? formatDateTime(post.created_at) : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Logged as goal
                    </p>
                    <p className="text-sm">{formatDateTime(goal.created_at)}</p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Step progress
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-emerald-500/30",
                        goal.status === "completed" ? "text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {completedCount}/{totalSteps} steps completed
                    </Badge>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              </section>

              {post && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                    Attached media
                  </h3>
                  <HopePostMediaRow
                    attachments={post.attachments ?? []}
                    imageUrls={post.image_urls ?? []}
                  />
                </section>
              )}

              {attachedProducts.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                    Linked products
                  </h3>
                  <HopeAttachedProductsWidget products={attachedProducts} />
                </section>
              )}

              {proofItems.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Proof history
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {proofItems.map((milestone) => (
                      <a
                        key={milestone.id}
                        href={milestone.proof_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="overflow-hidden rounded-lg border border-border/60 bg-surface-2/20 transition hover:border-emerald-500/40"
                      >
                        <img
                          src={milestone.proof_url!}
                          alt={`Step ${milestone.order_index + 1} proof`}
                          className="h-28 w-full object-cover"
                        />
                        <div className="p-2">
                          <p className="text-[10px] font-medium uppercase text-emerald-400/90">
                            Step {milestone.order_index + 1}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {milestone.title}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {goal.guidance && (
                <section className="rounded-lg border border-border/50 bg-emerald-500/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                    AI guidance
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{goal.guidance.instruction_text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Next: {goal.guidance.suggested_next_step}
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
