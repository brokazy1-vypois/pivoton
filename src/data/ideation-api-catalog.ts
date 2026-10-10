import type { IdeationApiDefinition } from "@/types/ideation";

export const IDEATION_API_CATALOG: IdeationApiDefinition[] = [
  {
    id: "supabase",
    name: "Supabase",
    provider: "Supabase",
    description: "Postgres database, auth, storage, and realtime subscriptions.",
    pricingModel: "freemium",
    pricingLabel: "Free tier · Pay-as-you-go",
    logoEmoji: "⚡",
    signupUrl: "https://supabase.com/dashboard",
    envVars: [
      { key: "SUPABASE_URL", label: "Project URL", placeholder: "https://xxx.supabase.co" },
      { key: "SUPABASE_ANON_KEY", label: "Anon public key", placeholder: "eyJ...", secret: true },
    ],
    keywords: [
      "auth",
      "login",
      "database",
      "postgres",
      "storage",
      "realtime",
      "user",
      "signup",
      "backend",
      "supabase",
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    provider: "Stripe",
    description: "Accept card payments, subscriptions, and checkout flows.",
    pricingModel: "pay-as-you-go",
    pricingLabel: "2.9% + 30¢ per transaction",
    logoEmoji: "💳",
    signupUrl: "https://dashboard.stripe.com/register",
    envVars: [
      { key: "STRIPE_PUBLIC_KEY", label: "Publishable key", placeholder: "pk_test_..." },
      { key: "STRIPE_SECRET_KEY", label: "Secret key", placeholder: "sk_test_...", secret: true },
    ],
    keywords: ["payment", "checkout", "subscription", "billing", "stripe", "purchase", "cart", "shop"],
  },
  {
    id: "plaid",
    name: "Plaid",
    provider: "Plaid",
    description: "Link bank accounts for deposits, balances, and ACH transfers.",
    pricingModel: "monthly",
    pricingLabel: "Sandbox free · Production per-link pricing",
    logoEmoji: "🏦",
    signupUrl: "https://dashboard.plaid.com/signup",
    envVars: [
      { key: "PLAID_CLIENT_ID", label: "Client ID", placeholder: "..." },
      { key: "PLAID_SECRET", label: "Secret", placeholder: "...", secret: true },
      { key: "PLAID_ENV", label: "Environment", placeholder: "sandbox" },
    ],
    keywords: ["bank", "plaid", "ach", "deposit", "wallet", "transfer", "finance", "account"],
  },
  {
    id: "mapbox",
    name: "Mapbox",
    provider: "Mapbox",
    description: "Interactive maps, geocoding, and location search.",
    pricingModel: "freemium",
    pricingLabel: "50k free map loads / month",
    logoEmoji: "🗺️",
    signupUrl: "https://account.mapbox.com/auth/signup/",
    envVars: [
      {
        key: "MAPBOX_ACCESS_TOKEN",
        label: "Access token",
        placeholder: "pk.eyJ...",
        secret: true,
      },
    ],
    keywords: ["map", "location", "geo", "address", "directions", "mapbox", "gps"],
  },
  {
    id: "openai",
    name: "OpenAI",
    provider: "OpenAI",
    description: "GPT models for chat, embeddings, and AI features.",
    pricingModel: "pay-as-you-go",
    pricingLabel: "Pay per token",
    logoEmoji: "🤖",
    signupUrl: "https://platform.openai.com/signup",
    envVars: [{ key: "OPENAI_API_KEY", label: "API key", placeholder: "sk-...", secret: true }],
    keywords: ["openai", "gpt", "chatbot", "ai", "llm", "assistant", "completion"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    provider: "Google",
    description: "Multimodal AI for text, code, and image understanding.",
    pricingModel: "freemium",
    pricingLabel: "Free tier · Pay-as-you-go",
    logoEmoji: "✨",
    signupUrl: "https://aistudio.google.com/apikey",
    envVars: [{ key: "GEMINI_API_KEY", label: "API key", placeholder: "AIza...", secret: true }],
    keywords: ["gemini", "google ai", "multimodal", "vision", "code generation"],
  },
  {
    id: "twilio",
    name: "Twilio",
    provider: "Twilio",
    description: "SMS, voice calls, and verification codes.",
    pricingModel: "pay-as-you-go",
    pricingLabel: "Pay per message / minute",
    logoEmoji: "📱",
    signupUrl: "https://www.twilio.com/try-twilio",
    envVars: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "AC..." },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth token", placeholder: "...", secret: true },
    ],
    keywords: ["sms", "text", "phone", "call", "verify", "otp", "twilio", "messaging"],
  },
];

export function getApiById(id: string): IdeationApiDefinition | undefined {
  return IDEATION_API_CATALOG.find((api) => api.id === id);
}

export function recommendApisFromText(text: string, limit = 4): string[] {
  const lower = text.toLowerCase();
  const scored = IDEATION_API_CATALOG.map((api) => {
    const score = api.keywords.reduce((sum, kw) => (lower.includes(kw) ? sum + 1 : sum), 0);
    return { id: api.id, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ["supabase"];
  }

  return scored.slice(0, limit).map((item) => item.id);
}
