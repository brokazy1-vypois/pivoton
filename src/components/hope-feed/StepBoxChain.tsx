import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Target,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchStepChats,
  getStepChatUserFacingError,
  hydrateStepChatAttachments,
  isStepUnlocked,
  negotiateGoalStep,
  postProofToStepChat,
  persistStepProofUrl,
  uploadStepProof,
  verifyStepProof,
} from "@/services/hope-goals";
import { FinalGoalMeshCard } from "@/components/hope-feed/timeline-effects";
import { isGoalTrackerActive } from "@/lib/goal-tracker-state";
import type { GoalMilestone, GoalWithDetails, StepChatMessage } from "@/types/hope-goal";
import { toast } from "sonner";

interface StepBoxChainProps {
  goal: GoalWithDetails;
  side: "left" | "right";
  isOwnProfile: boolean;
  onGoalUpdate: (goal: GoalWithDetails) => void;
  onOpenGoalDetails?: () => void;
}

function HorizontalArrow({
  active,
  direction = "right",
}: {
  active: boolean;
  direction?: "left" | "right";
}) {
  const iconClass = cn(
    "h-3.5 w-3.5 shrink-0",
    active ? "text-emerald-400" : "text-muted-foreground/55",
  );

  return (
    <motion.div
      className="flex h-11 w-12 shrink-0 items-center justify-center sm:w-16"
      initial={{ opacity: 0, scaleX: 0.3 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.35 }}
      aria-hidden
    >
      {direction === "left" ? (
        <>
          <ArrowLeft className={iconClass} />
          <div
            className={cn(
              "mx-0.5 min-w-0 flex-1",
              active
                ? "h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                : "h-0 border-t-2 border-dashed border-muted-foreground/45",
            )}
          />
        </>
      ) : (
        <>
          <div
            className={cn(
              "mx-0.5 min-w-0 flex-1",
              active
                ? "h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                : "h-0 border-t-2 border-dashed border-muted-foreground/45",
            )}
          />
          <ArrowRight className={iconClass} />
        </>
      )}
    </motion.div>
  );
}

interface StepBoxProps {
  milestone: GoalMilestone;
  stepIndex: number;
  unlocked: boolean;
  isOwnProfile: boolean;
  goal: GoalWithDetails;
  onGoalUpdate: (goal: GoalWithDetails) => void;
}

function StepChatBubble({
  message,
  onAttachmentClick,
}: {
  message: StepChatMessage;
  onAttachmentClick?: (url: string) => void;
}) {
  const isSystem = message.role === "system";
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "rounded px-2 py-1.5",
        isSystem
          ? "border border-emerald-500/25 bg-emerald-500/5"
          : isUser
            ? "bg-surface-2"
            : "bg-emerald-500/10 text-emerald-100",
      )}
    >
      <p className={cn("text-[11px] leading-relaxed", isSystem && "text-emerald-200/90")}>
        {message.content}
      </p>
      {message.attachment_url && (
        <div className="mt-1.5">
          {message.attachment_type === "image" ? (
            <button
              type="button"
              onClick={() => onAttachmentClick?.(message.attachment_url!)}
              className="block overflow-hidden rounded-md ring-1 ring-border/50 transition hover:ring-emerald-500/50"
            >
              <img
                src={message.attachment_url}
                alt={message.attachment_name ?? "Proof upload"}
                className="h-16 w-full object-cover"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAttachmentClick?.(message.attachment_url!)}
              className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-surface-2/60 px-2 py-1.5 text-left transition hover:border-emerald-500/40"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate text-[10px]">
                {message.attachment_name ?? "Proof document"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StepBox({
  milestone,
  stepIndex,
  unlocked,
  isOwnProfile,
  goal,
  onGoalUpdate,
}: StepBoxProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceProofRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<StepChatMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsImage, setPreviewIsImage] = useState(true);

  const verified = milestone.verification_status === "verified";
  const rejected = milestone.verification_status === "rejected";

  const patchMilestone = (next: GoalMilestone) => {
    onGoalUpdate({
      ...goal,
      milestones: goal.milestones.map((item) => (item.id === next.id ? next : item)),
    });
  };

  const appendProofToChat = async (proofUrl: string, file: File) => {
    const proofMessage = await postProofToStepChat({
      milestoneId: milestone.id,
      proofUrl,
      file,
    });
    setMessages((current) => [...current, proofMessage]);
    setChatOpen(true);
    setChatLoaded(true);
  };

  const runProofUpload = async (file: File) => {
    if (!isOwnProfile || !unlocked || busy) return;
    setBusy(true);
    try {
      const proofUrl = await uploadStepProof(goal.user_id, milestone.id, file);
      const saved = await persistStepProofUrl(milestone.id, proofUrl);
      patchMilestone(saved);
      await appendProofToChat(proofUrl, file);
      toast.success("Proof added to step discussion");

      try {
        const { milestone: verifiedMilestone, result } = await verifyStepProof({
          milestone: saved,
          proofFile: file,
        });
        patchMilestone(verifiedMilestone);

        if (result.verified) {
          toast.success("Step verified!", { description: result.summary });
        } else {
          toast.error("Proof not accepted", { description: result.summary });
        }
      } catch {
        toast.message("Proof saved in chat", {
          description:
            "AI verification is unavailable right now — you can still discuss this step.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload proof.");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadProof = async (file: File) => {
    await runProofUpload(file);
  };

  const openAttachmentPreview = (url: string) => {
    const fromMessage = messages.find((msg) => msg.attachment_url === url);
    setPreviewIsImage(
      fromMessage?.attachment_type === "image" || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url),
    );
    setPreviewUrl(url);
  };

  const openChat = async () => {
    const willOpen = !chatOpen;
    setChatOpen(willOpen);
    if (willOpen && !chatLoaded) {
      const history = await fetchStepChats(milestone.id);
      setMessages(hydrateStepChatAttachments(history, milestone.proof_url));
      setChatLoaded(true);
    }
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || busy || sendingRef.current) return;

    sendingRef.current = true;
    setBusy(true);

    const optimisticUser: StepChatMessage = {
      id: `optimistic-${Date.now()}`,
      milestone_id: milestone.id,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    const historyWithOptimistic = [...messages, optimisticUser];
    setMessages(historyWithOptimistic);
    setChatInput("");

    try {
      const {
        milestone: updated,
        messages: nextMessages,
        rateLimited,
      } = await negotiateGoalStep({
        goalTitle: goal.title,
        milestone,
        userMessage: trimmed,
        history: messages,
      });
      patchMilestone(updated);
      setMessages(nextMessages);

      if (rateLimited) {
        toast.warning("Rate limit reached. Please wait a moment before sending another request.");
      }
    } catch (error) {
      const { tone, message } = getStepChatUserFacingError(error);
      if (tone === "warning") {
        toast.warning(message);
      } else {
        toast.error(message);
      }
      setMessages(historyWithOptimistic);
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stepIndex * 0.08 }}
      className={cn(
        "relative z-10 w-[168px] shrink-0 rounded-xl border p-3 sm:w-[190px]",
        verified
          ? "border-emerald-500/50 bg-emerald-500/10"
          : unlocked
            ? "border-border/70 bg-[#0B1120]"
            : "border-border/40 bg-[#0B1120]/80 opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">
          Step {stepIndex + 1}
        </p>
        {verified ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : !unlocked ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        ) : null}
      </div>

      <p className="mt-1.5 text-sm font-medium leading-snug">{milestone.title}</p>
      {milestone.criteria && milestone.criteria !== milestone.title && (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{milestone.criteria}</p>
      )}

      {milestone.proof_url && (
        <button
          type="button"
          onClick={() => openAttachmentPreview(milestone.proof_url!)}
          className="mt-2 block w-full overflow-hidden rounded-md ring-1 ring-border/40 transition hover:ring-emerald-500/50"
        >
          <img
            src={milestone.proof_url}
            alt="Current step proof"
            className="h-14 w-full object-cover"
          />
        </button>
      )}

      {rejected && <p className="mt-2 text-[11px] text-red-400">Proof rejected — upload again</p>}

      {isOwnProfile && unlocked && !verified && (
        <div className="mt-3 flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUploadProof(file);
              event.target.value = "";
            }}
          />
          <input
            ref={replaceProofRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUploadProof(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 w-full text-xs"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3 w-3" />
            )}
            Upload proof
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-full text-xs"
            onClick={() => void openChat()}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Discuss step
          </Button>
        </div>
      )}

      {chatOpen && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
          <div className="custom-scrollbar max-h-36 space-y-1.5 overflow-y-auto text-[11px]">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">Negotiate step criteria with AI…</p>
            ) : (
              messages.map((msg) => (
                <StepChatBubble
                  key={msg.id}
                  message={msg}
                  onAttachmentClick={openAttachmentPreview}
                />
              ))
            )}
          </div>
          <div className="flex gap-1">
            <Input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Adjust this step…"
              className="h-8 text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendChat();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-2"
              disabled={busy || !chatInput.trim()}
              onClick={() => void handleSendChat()}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Step proof</DialogTitle>
            <DialogDescription>
              Review or replace the uploaded proof for this step.
            </DialogDescription>
          </DialogHeader>
          {previewUrl &&
            (previewIsImage ? (
              <img
                src={previewUrl}
                alt="Proof preview"
                className="max-h-[60vh] w-full rounded-lg object-contain"
              />
            ) : (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-4 py-3 text-sm text-emerald-300 hover:border-emerald-500/40"
              >
                <FileText className="h-5 w-5" />
                Open proof document
              </a>
            ))}
          {isOwnProfile && unlocked && !verified && (
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPreviewUrl(null);
                  replaceProofRef.current?.click();
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Replace proof
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function FinalGoalBox({
  goalId,
  title,
  active,
  onOpenDetails,
}: {
  goalId: string;
  title: string;
  active: boolean;
  onOpenDetails?: () => void;
}) {
  return (
    <FinalGoalMeshCard
      active={active}
      goalId={goalId}
      title={title}
      {...(onOpenDetails ? { onClick: onOpenDetails } : {})}
    >
      <div
        className={cn("flex items-center gap-1.5", active ? "text-[#0f172a]" : "text-emerald-400")}
      >
        <Target className="h-4 w-4 shrink-0 drop-shadow-sm" />
        <p className="text-[10px] font-semibold uppercase tracking-wide">Final goal</p>
      </div>
      <p
        className={cn(
          "mt-2 line-clamp-3 text-sm font-semibold leading-snug",
          active ? "text-[#1e293b]" : "text-foreground",
        )}
      >
        {title}
      </p>
      {onOpenDetails && (
        <p
          className={cn("mt-1.5 text-[10px]", active ? "text-[#334155]" : "text-muted-foreground")}
        >
          Tap to view full details
        </p>
      )}
    </FinalGoalMeshCard>
  );
}

export function StepBoxChain({
  goal,
  side,
  isOwnProfile,
  onGoalUpdate,
  onOpenGoalDetails,
}: StepBoxChainProps) {
  const milestones = [...goal.milestones].sort((a, b) => a.order_index - b.order_index);
  const goalActive = isGoalTrackerActive(goal);
  const isLeft = side === "left";
  const arrowDirection = isLeft ? "left" : "right";

  const segments: ReactNode[] = [];

  milestones.forEach((milestone, index) => {
    const prevDone = index === 0 || milestones[index - 1]?.is_completed;
    const isLastStep = index === milestones.length - 1;
    const stepComplete = Boolean(prevDone && milestone.is_completed);

    segments.push(
      <StepBox
        key={milestone.id}
        milestone={milestone}
        stepIndex={index}
        unlocked={isStepUnlocked(milestones, index)}
        isOwnProfile={isOwnProfile}
        goal={goal}
        onGoalUpdate={onGoalUpdate}
      />,
    );

    segments.push(
      <HorizontalArrow
        key={`arrow-${milestone.id}`}
        active={isLastStep ? goalActive : stepComplete}
        direction={arrowDirection}
      />,
    );
  });

  segments.push(
    <FinalGoalBox
      key="final"
      goalId={goal.id}
      title={goal.title}
      active={goalActive}
      {...(onOpenGoalDetails ? { onOpenDetails: onOpenGoalDetails } : {})}
    />,
  );

  return (
    <div className="custom-scrollbar relative z-10 w-full max-w-full overflow-x-auto scroll-smooth rounded-lg bg-surface/95 py-2 pb-2 [-webkit-overflow-scrolling:touch]">
      <div
        className={cn(
          "relative z-10 inline-flex min-w-min items-center px-1",
          isLeft ? "flex-row-reverse justify-start" : "flex-row justify-start",
        )}
      >
        {segments}
      </div>
    </div>
  );
}
