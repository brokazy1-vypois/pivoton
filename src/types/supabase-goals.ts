/**
 * Goal tracker tables used by hope-goals.ts (align with scripts/supabase-goals-setup.sql).
 * Table name is goal_milestones — not goal_steps.
 */

export type GoalStatus = "in_progress" | "completed";
export type StepVerificationStatus = "pending" | "verified" | "rejected";
export type StepChatRole = "user" | "assistant" | "system";
export type StepChatAttachmentType = "image" | "document";

export interface GoalsRow {
  id: string;
  user_id: string;
  post_id: string;
  title: string;
  status: GoalStatus;
  created_at: string;
}

export interface GoalMilestonesRow {
  id: string;
  goal_id: string;
  title: string;
  criteria: string | null;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
  proof_url: string | null;
  verification_status: StepVerificationStatus;
}

export interface AiGuidanceNotesRow {
  id: string;
  goal_id: string;
  instruction_text: string;
  suggested_next_step: string;
  created_at: string;
}

export interface StepChatsRow {
  id: string;
  milestone_id: string;
  role: StepChatRole;
  content: string;
  created_at: string;
  attachment_url: string | null;
  attachment_type: StepChatAttachmentType | null;
  attachment_name: string | null;
}

/** Subset of Database.public.Tables for goal tracker queries. */
export interface GoalTrackerDatabase {
  public: {
    Tables: {
      goals: {
        Row: GoalsRow;
        Insert: Omit<GoalsRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GoalsRow>;
      };
      goal_milestones: {
        Row: GoalMilestonesRow;
        Insert: Omit<GoalMilestonesRow, "id"> & { id?: string };
        Update: Partial<GoalMilestonesRow>;
      };
      ai_guidance_notes: {
        Row: AiGuidanceNotesRow;
        Insert: Omit<AiGuidanceNotesRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AiGuidanceNotesRow>;
      };
      step_chats: {
        Row: StepChatsRow;
        Insert: Omit<StepChatsRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<StepChatsRow>;
      };
    };
  };
}
