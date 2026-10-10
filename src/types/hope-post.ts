export type HopeStatus = "fulfilled" | "in_progress";

export type HopeAttachmentFileType = "image" | "video" | "document";

export interface HopePostAttachment {
  url: string;
  file_type: HopeAttachmentFileType;
  file_name: string;
}

export interface HopePost {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  job_role: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  edited_at?: string | null;
  hope_status?: HopeStatus | null;
  /** Persisted media from Supabase Storage. */
  attachments?: HopePostAttachment[];
  /** Optional embedded marketplace product URL (legacy single link). */
  marketplace_link?: string | null;
  /** All marketplace product URLs attached to this post. */
  marketplace_links?: string[];
  /** Legacy seed thumbnails — derived from attachments when present. */
  image_urls?: string[];
  /** Geo pin for Contact Search map (optional). */
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
}

export interface HopeComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  job_role: string | null;
  content: string;
  created_at: string;
}

export interface CommentNode extends HopeComment {
  children: CommentNode[];
}

export interface HopeUserProfile {
  id: string;
  fullName: string;
  job_role: string;
  avatar: string;
}

export type SubscriptionStatus = "free" | "premium" | "broker_pro";

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  avatar: string | null;
  role?: string;
  isPremium?: boolean;
  subscriptionStatus?: SubscriptionStatus;
}

export interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "amelia@pivoton.demo",
    password: "demo123456",
    fullName: "Amelia Roux",
    role: "Premium investor",
  },
  {
    email: "daniel@pivoton.demo",
    password: "demo123456",
    fullName: "Daniel Okafor",
    role: "Series 65",
  },
];
