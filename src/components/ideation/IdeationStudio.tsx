import { useState } from "react";
import { RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ShareToFeedModal } from "@/components/ideation/ShareToFeedModal";
import { IdeationChatPanel } from "@/components/ideation/IdeationChatPanel";
import { IdeationPreviewCanvas } from "@/components/ideation/IdeationPreviewCanvas";
import { useAuth } from "@/context/AuthContext";
import { useIdeationSession } from "@/hooks/useIdeationSession";
import { Button } from "@/components/ui/button";

export function IdeationStudio() {
  const { user, openAuthModal } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);

  const {
    messages,
    envVars,
    prototypeHtml,
    codeBundle,
    metadata,
    isLoading,
    loadingPhase,
    isSaving,
    isPublishing,
    canSave,
    canApplyKeys,
    isApiConnected,
    connectedApiIds,
    savedPrototype,
    setEnvVar,
    sendMessage,
    applyKeysAndGenerate,
    savePrototype,
    sharePrototype,
    resetSession,
    activeEnvKeys,
    generationWarning,
    hasGeminiKey,
    prototypeEnvVars,
    regeneratePreview,
  } = useIdeationSession({
    userId: user?.id,
    userName: user?.fullName,
    userAvatar: user?.avatar,
  });

  const handleSave = async () => {
    if (!user) {
      openAuthModal("Sign in to save your prototype.");
      return;
    }
    if (!prototypeHtml.trim()) {
      toast.error("Generate a preview first before saving.");
      return;
    }
    try {
      await savePrototype();
      toast.success("Prototype saved to your account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save prototype.");
    }
  };

  const handleShareClick = async () => {
    if (!user) {
      openAuthModal("Sign in to share your prototype.");
      return;
    }
    if (!prototypeHtml.trim()) {
      toast.error("Generate a preview first before sharing.");
      return;
    }
    try {
      if (!savedPrototype) await savePrototype();
      setShareOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare prototype for sharing.");
    }
  };

  const handlePublish = async (title: string, description: string) => {
    try {
      await sharePrototype(title, description);
      setShareOpen(false);
      toast.success("Prototype published to the Idea Feed!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish prototype.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-slate-100">Ideation Studio</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Convert ideas into functional prototypes. The AI agent scaffolds React + Tailwind UI,
            recommends third-party APIs, and lets you paste keys to activate integrations instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasGeminiKey && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300">
              Gemini active
            </span>
          )}
          {isApiConnected ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
              API connected · generating deliverables
            </span>
          ) : (
            activeEnvKeys.length > 0 && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                {activeEnvKeys.length} env var{activeEnvKeys.length === 1 ? "" : "s"} active
              </span>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetSession}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <IdeationChatPanel
          messages={messages}
          envVars={envVars}
          connectedApiIds={connectedApiIds}
          isApiConnected={isApiConnected}
          isLoading={isLoading}
          loadingPhase={loadingPhase}
          onSend={sendMessage}
          onEnvVarChange={setEnvVar}
          onApplyAndGenerate={(apiId) => void applyKeysAndGenerate(apiId)}
          onRegeneratePreview={() => void regeneratePreview()}
        />
        <IdeationPreviewCanvas
          html={prototypeHtml}
          codeBundle={codeBundle}
          envVars={prototypeEnvVars}
          generationWarning={generationWarning}
          hasGeminiKey={hasGeminiKey}
          canSave={canSave}
          canApplyKeys={canApplyKeys}
          isGenerating={isLoading && loadingPhase === "wiring"}
          isSaving={isSaving}
          isPublishing={isPublishing}
          isPublished={Boolean(savedPrototype?.is_published)}
          onSave={() => void handleSave()}
          onDeploy={() => void handleShareClick()}
          onApplyKeys={() => void applyKeysAndGenerate()}
        />
      </div>

      <ShareToFeedModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        defaultTitle={metadata.title}
        defaultDescription={metadata.description}
        isPublishing={isPublishing}
        onConfirm={(title, description) => void handlePublish(title, description)}
      />
    </div>
  );
}
