import { ExternalLink, KeyRound, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiById } from "@/data/ideation-api-catalog";
import { cn } from "@/lib/utils";

interface ApiRecommendationCardProps {
  apiId: string;
  envVars: Record<string, string>;
  onEnvVarChange: (key: string, value: string) => void;
  onApplyAndGenerate?: (apiId: string) => void;
  isGenerating?: boolean;
  /** When true, hide credential inputs — keys already applied this session */
  isConnected?: boolean;
}

const PRICING_TONE: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  freemium: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  "pay-as-you-go": "text-amber-400 bg-amber-500/10 border-amber-500/30",
  monthly: "text-violet-400 bg-violet-500/10 border-violet-500/30",
};

export function ApiRecommendationCard({
  apiId,
  envVars,
  onEnvVarChange,
  onApplyAndGenerate,
  isGenerating = false,
  isConnected = false,
}: ApiRecommendationCardProps) {
  const api = getApiById(apiId);
  if (!api) return null;

  const configuredCount = api.envVars.filter((v) => envVars[v.key]?.trim()).length;
  const isFullyConfigured = configuredCount === api.envVars.length;

  if (isConnected) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-lg">
            {api.logoEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-100">{api.name}</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <Check className="h-3 w-3" />
                Connected
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Keys saved — credentials injected into the live preview via{" "}
              <code className="text-emerald-400">window.__PIVOTON_ENV__</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/80 bg-[#1e293b] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-lg">
          {api.logoEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-100">{api.name}</h4>
            <span className="text-[11px] text-slate-500">{api.provider}</span>
            {isFullyConfigured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <Check className="h-3 w-3" />
                Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{api.description}</p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
              PRICING_TONE[api.pricingModel] ?? PRICING_TONE.freemium,
            )}
          >
            {api.pricingLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          asChild
        >
          <a href={api.signupUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Get API Key
          </a>
        </Button>
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-700/60 pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <KeyRound className="h-3 w-3" />
          Environment variables
        </p>
        {api.envVars.map((envVar) => (
          <div key={envVar.key}>
            <label className="mb-1 block text-[11px] text-slate-400">{envVar.label}</label>
            <Input
              type={envVar.secret ? "password" : "text"}
              value={envVars[envVar.key] ?? ""}
              onChange={(e) => onEnvVarChange(envVar.key, e.target.value)}
              placeholder={envVar.placeholder ?? envVar.key}
              disabled={isGenerating}
              className="h-8 border-slate-600 bg-slate-900/80 text-xs text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
            />
          </div>
        ))}

        {isFullyConfigured && onApplyAndGenerate && (
          <Button
            size="sm"
            disabled={isGenerating}
            onClick={() => onApplyAndGenerate(apiId)}
            className="mt-2 w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Wiring keys and scaffolding prototype…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Apply Keys & Generate Deliverables
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
