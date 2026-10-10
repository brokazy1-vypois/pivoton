import { Check, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasGeminiKeyConfigured } from "@/lib/gemini-key";

interface GeminiKeyPanelProps {
  envVars: Record<string, string>;
  onEnvVarChange: (key: string, value: string) => void;
  onRegenerate?: () => void;
  compact?: boolean;
}

export function GeminiKeyPanel({
  envVars,
  onEnvVarChange,
  onRegenerate,
  compact = false,
}: GeminiKeyPanelProps) {
  const isConfigured = hasGeminiKeyConfigured(envVars);
  const storedKey = envVars.GEMINI_API_KEY ?? "";

  if (isConfigured && compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs text-emerald-300">Gemini AI active</span>
        <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
      </div>
    );
  }

  if (isConfigured) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-100">Google Gemini</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <Check className="h-3 w-3" />
            Active
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          AI generation is enabled. Full custom UI will be generated from your prompts.
        </p>
        {onRegenerate && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-7 border-slate-600 text-xs text-slate-300"
            onClick={onRegenerate}
          >
            Regenerate preview with Gemini
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-lg">
          ✨
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-100">Google Gemini API key</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Required for AI-generated UI. Paste your key here — no server restart needed. Keys are
            stored locally in your browser session.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" asChild>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Get API Key
          </a>
        </Button>
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-700/60 pt-4">
        <label className="mb-1 block text-[11px] text-slate-400">Gemini API key</label>
        <Input
          type="password"
          value={storedKey}
          onChange={(e) => onEnvVarChange("GEMINI_API_KEY", e.target.value)}
          placeholder="AIza..."
          className="h-8 border-slate-600 bg-slate-900/80 text-xs text-slate-100 placeholder:text-slate-600"
        />
        <p className="text-[10px] text-slate-600">
          Or add <code className="text-slate-500">VITE_GEMINI_API_KEY</code> to{" "}
          <code className="text-slate-500">.env.local</code> and restart the dev server.
        </p>
      </div>
    </div>
  );
}
