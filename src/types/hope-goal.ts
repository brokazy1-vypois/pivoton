import type { HopePost } from "@/types/hope-post";

export type GoalStatus = "in_progress" | "completed";
export type StepVerificationStatus = "pending" | "verified" | "rejected";

export interface Goal {
  id: string;
  user_id: string;
  post_id: string;
  title: string;
  status: GoalStatus;
  created_at: string;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  criteria?: string | null;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
  proof_url?: string | null;
  verification_status?: StepVerificationStatus;
}

export interface AiGuidanceNote {
  id: string;
  goal_id: string;
  instruction_text: string;
  suggested_next_step: string;
  created_at: string;
}

export type StepChatAttachmentType = "image" | "document";

export interface StepChatMessage {
  id: string;
  milestone_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: StepChatAttachmentType | null;
  attachment_name?: string | null;
}

export interface GoalWithDetails extends Goal {
  milestones: GoalMilestone[];
  guidance: AiGuidanceNote | null;
  post?: HopePost | null;
}

export interface ConvertGoalAiResult {
  big_goal_title: string;
  milestones: string[];
  next_action_instruction: string;
}

export interface ConvertHopePostToGoalInput {
  userId: string;
  post: HopePost;
  attachedProductNames?: string[];
}

export interface VerifyStepProofResult {
  verified: boolean;
  summary: string;
  confidence: number;
}

export interface NegotiateStepResult {
  accepted: boolean;
  title: string;
  criteria: string;
  assistant_reply: string;
}
