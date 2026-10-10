import { Fragment, type ReactNode } from "react";

function highlightTickers(text: string): ReactNode[] {
  const parts = text.split(/(\$[A-Z]{1,5}\b|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\$[A-Z]{1,5}\b/.test(part)) {
      return (
        <span key={i} className="font-semibold text-emerald-400">
          {part}
        </span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function FinanceAgentMessageBody({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (/^[-*]\s/.test(trimmed)) {
          return (
            <p key={i} className="pl-3">
              <span className="text-primary">·</span>{" "}
              {highlightTickers(trimmed.replace(/^[-*]\s/, ""))}
            </p>
          );
        }

        if (/^\|.+\|$/.test(trimmed)) {
          return (
            <code
              key={i}
              className="block overflow-x-auto rounded bg-slate-900/60 px-2 py-0.5 text-xs text-foreground/90"
            >
              {trimmed}
            </code>
          );
        }

        return <p key={i}>{highlightTickers(line)}</p>;
      })}
    </div>
  );
}

export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\|/g, " ")
    .replace(/\$/g, " dollars ")
    .replace(/\n+/g, " ")
    .trim();
}
