import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AvaturnSDK } from "@avaturn/sdk";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseAvaturnExportResult, type AvaturnExportResult } from "@/lib/avaturn-env";
import { createAvaturnEditorSession } from "@/services/avaturn-session";

interface AvaturnAvatarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onExport: (result: AvaturnExportResult) => void;
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function AvaturnAvatarModal({
  open,
  onOpenChange,
  userId,
  onExport,
}: AvaturnAvatarModalProps) {
  const sdkRef = useRef<AvaturnSDK | null>(null);
  const exportHandledRef = useRef(false);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["avaturn-editor-session", userId],
    queryFn: () => createAvaturnEditorSession(userId),
    enabled: open && Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  const editorUrl = sessionQuery.data?.url ?? null;

  const handleExport = useCallback(
    (result: AvaturnExportResult) => {
      if (exportHandledRef.current) return;
      exportHandledRef.current = true;
      onExport(result);
      onOpenChange(false);
    },
    [onExport, onOpenChange],
  );

  useEffect(() => {
    if (!open) {
      exportHandledRef.current = false;
      sdkRef.current?.destroy();
      sdkRef.current = null;
      setMountNode(null);
      setLoadState("idle");
      setErrorMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !mountNode || !editorUrl) return;

    let cancelled = false;
    setLoadState("loading");
    setErrorMessage(null);
    exportHandledRef.current = false;

    mountNode.replaceChildren();

    const sdk = new AvaturnSDK();
    sdkRef.current = sdk;

    sdk.on("export", (data) => {
      const result = parseAvaturnExportResult(data);
      if (!result) return;
      handleExport(result);
    });

    sdk.on("load", () => {
      if (cancelled) return;
      setLoadState("ready");
    });

    sdk.on("error", (data) => {
      if (cancelled) return;
      setErrorMessage(data.message ?? "Avaturn encountered an error.");
      setLoadState("error");
    });

    const handleWindowMessage = (event: MessageEvent) => {
      const result = parseAvaturnExportResult(event.data);
      if (!result) return;
      handleExport(result);
    };
    window.addEventListener("message", handleWindowMessage);

    sdk
      .init(mountNode, {
        url: editorUrl,
        iframeClassName: "avaturn-sdk-iframe",
      })
      .then(() => {
        if (cancelled) return;
        setLoadState((current) => (current === "error" ? current : "ready"));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to initialize Avaturn.",
        );
        setLoadState("error");
      });

    return () => {
      cancelled = true;
      window.removeEventListener("message", handleWindowMessage);
      sdk.destroy();
      if (sdkRef.current === sdk) {
        sdkRef.current = null;
      }
      mountNode.replaceChildren();
    };
  }, [open, mountNode, editorUrl, handleExport]);

  const sessionError =
    sessionQuery.isError && !sessionQuery.data
      ? sessionQuery.error instanceof Error
        ? sessionQuery.error.message
        : "Could not start an Avaturn session."
      : null;

  const showLoading =
    sessionQuery.isLoading ||
    !editorUrl ||
    !mountNode ||
    loadState === "loading" ||
    loadState === "idle";

  const showError = Boolean(sessionError) || loadState === "error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,820px)] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Create 3D Avatar</DialogTitle>
          <DialogDescription>
            Sign in or create your Avaturn account, customize your character, then click{" "}
            <strong>Next</strong> to save it to your profile and the Contact Search map.
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[520px] flex-1 bg-[#0a0f18]">
          <div
            ref={setMountNode}
            className="absolute inset-0 [&_.avaturn-sdk-iframe]:absolute [&_.avaturn-sdk-iframe]:inset-0 [&_.avaturn-sdk-iframe]:h-full [&_.avaturn-sdk-iframe]:w-full [&_.avaturn-sdk-iframe]:border-0 [&_#avaturn-sdk-iframe]:absolute [&_#avaturn-sdk-iframe]:inset-0 [&_#avaturn-sdk-iframe]:h-full [&_#avaturn-sdk-iframe]:w-full [&_#avaturn-sdk-iframe]:border-0"
          />

          {showLoading && !showError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0f18]/90">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading Avaturn editor…</p>
            </div>
          )}

          {showError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0f18]/95 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="max-w-md text-sm text-muted-foreground">
                {sessionError ?? errorMessage ?? "Avaturn could not load."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
