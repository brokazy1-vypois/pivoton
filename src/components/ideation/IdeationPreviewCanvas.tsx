import { Loader2, Monitor, RefreshCw, Rocket, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrototypeSandbox } from "@/components/ideation/PrototypeSandbox";
import type { IdeationCodeBundle } from "@/types/ideation";
import { useState } from "react";

interface IdeationPreviewCanvasProps {
  html: string;
  codeBundle?: IdeationCodeBundle | null;
  envVars: Record<string, string>;
  generationWarning?: string | null;
  hasGeminiKey?: boolean;
  canSave?: boolean;
  canApplyKeys?: boolean;
  isGenerating?: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  isPublished?: boolean;
  onSave?: () => void;
  onDeploy?: () => void;
  onApplyKeys?: () => void;
}

export function IdeationPreviewCanvas({
  html,
  codeBundle = null,
  envVars,
  generationWarning = null,
  hasGeminiKey = false,
  canSave = false,
  canApplyKeys = false,
  isGenerating = false,
  isSaving = false,
  isPublishing = false,
  isPublished = false,
  onSave,
  onDeploy,
  onApplyKeys,
}: IdeationPreviewCanvasProps) {
  const [sandboxKey, setSandboxKey] = useState(0);
  const hasPreview = Boolean(html.trim() || (codeBundle && Object.keys(codeBundle.files).length > 0));

  return (
    <div className="flex h-full min-h-[520px] flex-col rounded-xl border border-slate-700/80 bg-[#0f172a]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Live preview</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
            In-browser sandbox
          </span>
          {isPublished && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              Deployed
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canApplyKeys && onApplyKeys && (
            <Button
              size="sm"
              className="h-7 bg-cyan-500 text-xs text-slate-950 hover:bg-cyan-400"
              disabled={isGenerating}
              onClick={onApplyKeys}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-3 w-3" />
                  Apply Keys & Generate
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-slate-600 text-xs text-slate-300 hover:bg-slate-800"
            disabled={!canSave || isSaving}
            onClick={onSave}
          >
            <Save className="mr-1 h-3 w-3" />
            {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            size="sm"
            className="h-7 bg-cyan-500 text-xs text-slate-950 hover:bg-cyan-400"
            disabled={!canSave || isPublishing}
            onClick={onDeploy}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Deploying…
              </>
            ) : (
              <>
                <Rocket className="mr-1 h-3 w-3" />
                Deploy to Feed
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-400 hover:text-slate-200"
            disabled={!hasPreview}
            onClick={() => setSandboxKey((k) => k + 1)}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1 bg-slate-950">
        {generationWarning && !isGenerating && !hasGeminiKey && (
          <div className="absolute inset-x-0 top-0 z-10 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
            {generationWarning}
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-x-0 top-0 z-10 border-b border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-center text-xs text-cyan-300">
            Wiring Supabase keys and scaffolding prototype…
          </div>
        )}
        <PrototypeSandbox
          key={sandboxKey}
          html={html}
          codeBundle={codeBundle}
          envVars={envVars}
          title="Ideation prototype preview"
          className="min-h-[420px]"
          emptyMessage="Your prototype will render here. Describe an app idea in the chat to generate a live, clickable sandbox."
        />
      </div>
    </div>
  );
}
