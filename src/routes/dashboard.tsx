import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkle, TrendingDown, TrendingUp, Wand2 } from "lucide-react";
import { FinanceAgentProvider } from "@/context/FinanceAgentContext";
import { FinanceAgentChat } from "@/components/dashboard/FinanceAgentChat";
import { AIVoiceBroker } from "@/components/dashboard/AIVoiceBroker";
import { IdeationStudio } from "@/components/ideation/IdeationStudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DASHBOARD_PORTFOLIO } from "@/data/dashboard-portfolio";
import { cn } from "@/lib/utils";

type DashboardView = "overview" | "ideation";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): { view: DashboardView } => ({
    view: search.view === "ideation" ? "ideation" : "overview",
  }),
  head: () => ({
    meta: [
      { title: "AI Working Dashboard — Pivoton Premium" },
      {
        name: "description",
        content:
          "Premium analytics: broker recommendation tracking, portfolio protection status, and an AI finance agent that answers questions and drafts your write-ups.",
      },
      { property: "og:title", content: "Pivoton AI Working Dashboard" },
      {
        property: "og:description",
        content: "Track broker calls, monitor guaranteed positions and consult the AI finance agent.",
      },
    ],
  }),
  component: Dashboard,
});

function DashboardOverview() {
  const { protectionPercent, protectionNote, positions, brokerCalls } = DASHBOARD_PORTFOLIO;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="panel p-7">
          <h2 className="text-sm font-semibold">Protection status</h2>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-3xl font-semibold">{protectionPercent}%</span>
            <span className="text-xs text-muted-foreground">of portfolio in covered positions</span>
          </div>
          <Progress value={protectionPercent} className="mt-4" />
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{protectionNote}</p>
        </div>

        <div className="panel p-7">
          <h2 className="text-sm font-semibold">Open positions</h2>
          <ul className="mt-5 divide-y divide-border">
            {positions.map((p) => (
              <li key={p.name} className="flex items-center gap-4 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.covered ? "Covered · max 3% loss fee" : "Uncovered"}
                  </div>
                </div>
                <span className="ml-auto text-sm">{p.value}</span>
                <span
                  className={`flex w-16 justify-end gap-1 text-sm ${p.up ? "text-primary" : "text-destructive"}`}
                >
                  {p.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {p.change}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tracked broker calls</h2>
            <Button variant="ghost" size="sm">
              <Sparkle className="mr-1.5 h-3.5 w-3.5" /> Auto-compose report
            </Button>
          </div>
          <ul className="mt-5 divide-y divide-border">
            {brokerCalls.map((c) => (
              <li key={c.broker + c.date} className="flex items-center gap-4 py-4 text-sm">
                <div>
                  <div className="font-medium">{c.broker}</div>
                  <div className="text-[11px] text-muted-foreground">{c.room}</div>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{c.date}</span>
                <span className={`w-16 text-right ${c.up ? "text-primary" : "text-destructive"}`}>
                  {c.result}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <FinanceAgentProvider>
          <div className="panel flex min-h-[480px] flex-col bg-[#0B0E14] p-7">
            <h2 className="text-sm font-semibold">AI finance agent</h2>
            <FinanceAgentChat />
          </div>

          <div className="panel flex min-h-[340px] flex-col bg-[#0B0E14] p-7">
            <AIVoiceBroker />
          </div>
        </FinanceAgentProvider>
      </div>
    </div>
  );
}

function Dashboard() {
  const { view } = Route.useSearch();

  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-semibold sm:text-5xl">Working dashboard</h1>
        <Badge className="bg-gold text-gold-foreground hover:bg-gold">Premium</Badge>
      </div>

      <div className="mt-8 inline-flex rounded-full border border-slate-700 bg-[#0f172a] p-1">
        <Link
          to="/dashboard"
          search={{ view: "overview" }}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition-colors",
            view === "overview"
              ? "bg-[#1e293b] text-slate-100 shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          Analytics
        </Link>
        <Link
          to="/dashboard"
          search={{ view: "ideation" }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
            view === "ideation"
              ? "bg-[#1e293b] text-slate-100 shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Ideation
        </Link>
      </div>

      <div className="mt-10">
        {view === "ideation" ? (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0f172a] p-6 sm:p-8">
            <IdeationStudio />
          </div>
        ) : (
          <DashboardOverview />
        )}
      </div>
    </div>
  );
}
