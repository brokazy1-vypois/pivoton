export type IdeationMessageRole = "user" | "assistant";

export type IdeationPricingModel = "free" | "freemium" | "pay-as-you-go" | "monthly";

export interface IdeationApiEnvVar {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export interface IdeationApiDefinition {
  id: string;
  name: string;
  provider: string;
  description: string;
  pricingModel: IdeationPricingModel;
  pricingLabel: string;
  logoEmoji: string;
  signupUrl: string;
  envVars: IdeationApiEnvVar[];
  keywords: string[];
}

export interface IdeationMessage {
  id: string;
  role: IdeationMessageRole;
  content: string;
  timestamp: number;
  recommendedApiIds?: string[];
  /** When true, never render API credential cards for this message */
  skipApiCards?: boolean;
}

export type IdeationGenerationSource = "gemini" | "local_scaffold";

export interface IdeationAgentResponse {
  assistantReply: string;
  htmlPreview: string;
  recommendedApiIds: string[];
  generationSource?: IdeationGenerationSource;
  generationWarning?: string;
}

export type IdeationChatMode = "chat" | "wire_keys";

export interface IdeationChatRequest {
  prompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  activeEnvKeys: string[];
  envVars?: Record<string, string>;
  geminiApiKey?: string;
  mode?: IdeationChatMode;
  originalPrompt?: string;
  isApiConnected?: boolean;
  connectedApiIds?: string[];
}

export type IdeationPrototypeStatus = "draft" | "published";
export type IdeationMonetizationTier = "free" | "active";

export interface IdeationCodeBundle {
  format: "html" | "react";
  entry: string;
  files: Record<string, string>;
}

export interface IdeationPrototype {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  description: string;
  html_preview: string;
  code_bundle: IdeationCodeBundle;
  env_vars: Record<string, string>;
  status: IdeationPrototypeStatus;
  monetization_tier: IdeationMonetizationTier;
  recommended_api_ids: string[];
  messages: IdeationMessage[];
  is_published: boolean;
  published_at: string | null;
  rating_sum: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface IdeationComment {
  id: string;
  prototype_id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

export interface IdeationRating {
  id: string;
  prototype_id: string;
  user_id: string;
  rating: number;
  created_at: string;
}

export interface SaveIdeationPrototypeInput {
  id?: string;
  user_id: string;
  author_name: string;
  author_avatar?: string | null;
  title: string;
  description: string;
  html_preview: string;
  code_bundle?: IdeationCodeBundle;
  env_vars?: Record<string, string>;
  status?: IdeationPrototypeStatus;
  monetization_tier?: IdeationMonetizationTier;
  recommended_api_ids: string[];
  messages: IdeationMessage[];
}

export interface PublishIdeationPrototypeInput {
  id: string;
  title: string;
  description: string;
  code_bundle?: IdeationCodeBundle;
  env_vars?: Record<string, string>;
  monetization_tier?: IdeationMonetizationTier;
}
