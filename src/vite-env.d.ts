/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_POST_ATTACHMENTS_BUCKET?: string;
  readonly VITE_SUPABASE_POST_ATTACHMENTS_BUCKET?: string;
  readonly NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?: string;
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
  readonly NEXT_PUBLIC_ALPACA_OAUTH_CLIENT_ID?: string;
  readonly NEXT_PUBLIC_ALPACA_REDIRECT_URI?: string;
  readonly NEXT_PUBLIC_GROWTHBOOK_API_HOST?: string;
  readonly NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY?: string;
  readonly NEXT_PUBLIC_RENDER_API_KEY?: string;
  readonly NEXT_PUBLIC_RENDER_API_URL?: string;
  readonly VITE_RENDER_API_KEY?: string;
  readonly VITE_RENDER_API_URL?: string;
  readonly VITE_TWELVE_DATA_API_KEY?: string;
  readonly TWELVE_DATA_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly ALPACA_API_KEY_ID?: string;
  readonly ALPACA_API_SECRET_KEY?: string;
  readonly ALPACA_PAPER_BASE_URL?: string;
  readonly ALPACA_BASE_URL?: string;
  readonly ALPACA_DATA_URL?: string;
  readonly ALPACA_OAUTH_CLIENT_SECRET?: string;
  readonly GOOGLE_OAUTH_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
