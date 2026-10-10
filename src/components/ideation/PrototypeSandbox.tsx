import { useMemo, useState } from "react";
import { AlertCircle, Monitor } from "lucide-react";
import { buildRunnableSrcDoc } from "@/lib/prototype-sandbox";
import type { IdeationCodeBundle } from "@/types/ideation";
import { cn } from "@/lib/utils";

interface PrototypeSandboxProps {
  html?: string;
  codeBundle?: IdeationCodeBundle | null;
  envVars?: Record<string, string>;
  title?: string;
  className?: string;
  emptyMessage?: string;
}

export function PrototypeSandbox({
  html = "",
  codeBundle = null,
  envVars = {},
  title = "Prototype preview",
  className,
  emptyMessage = "No runnable preview yet.",
}: PrototypeSandboxProps) {
  const [frameKey, setFrameKey] = useState(0);

  const srcDoc = useMemo(
    () => buildRunnableSrcDoc(html, envVars, codeBundle),
    [codeBundle, envVars, html],
  );

  const refresh = () => setFrameKey((k) => k + 1);

  if (!srcDoc) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
          className,
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-900">
          <Monitor className="h-6 w-6 text-slate-600" />
        </div>
        <p className="max-w-xs text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <iframe
        key={`${frameKey}-${srcDoc.length}`}
        id="prototype-sandbox-frame"
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        srcDoc={srcDoc}
        className="absolute inset-0 h-full w-full border-0 bg-slate-950"
        onLoad={() => {
          /* force visibility after load */
        }}
      />
      <button
        type="button"
        className="sr-only"
        onClick={refresh}
        aria-label="Refresh sandbox"
      />
    </div>
  );
}

export function PrototypeSandboxError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <AlertCircle className="h-8 w-8 text-amber-400" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
