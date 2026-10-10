import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Bot,
  LineChart,
  Store,
  GitBranch,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { HeroRobotAvatar } from "@/components/site/HeroRobotAvatar";
import { Button } from "@/components/ui/button";
import { LiquidGlassCapsule } from "@/components/ui/liquid-glass";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pivoton — AI Capital Protection & Guaranteed Trade Marketplace" },
      {
        name: "description",
        content:
          "Pivoton is an AI-driven capital protection platform: broker-verified recommendations, guaranteed ETF/stock deposits, and zero fee on profitable trades.",
      },
      { property: "og:title", content: "Pivoton — AI Capital Protection Platform" },
      {
        property: "og:description",
        content:
          "Broker-verified rumors, guaranteed trades with a 3% max loss-only insurance fee, and an AI dashboard for premium investors.",
      },
    ],
  }),
  component: Home,
});

const pillars = [
  {
    icon: ShieldCheck,
    title: "Capital protection first",
    body: "Guaranteed ETF and stock allocations are underwritten. You pay nothing on a winning trade — only a loss-case insurance fee, capped at 3%.",
  },
  {
    icon: Bot,
    title: "AI consultation agent",
    body: "A finance-trained chatbot answers trading, valuation, and regulation questions, and drafts your posts and recommendation write-ups.",
  },
  {
    icon: LineChart,
    title: "Broker track records",
    body: "Every certified broker's past calls are logged and scored. Statistical tools let premium users audit accuracy before paying for a room.",
  },
  {
    icon: Store,
    title: "Affiliated gateways",
    body: "We don't run an exchange. We aggregate certified brokerage gateways, plus commerce, delivery, edtech, auto and property partners.",
  },
  {
    icon: GitBranch,
    title: "Hope timeline",
    body: "A social feed of intentions — every thread rendered as a branching tree so long conversations stay legible.",
  },
  {
    icon: Wallet,
    title: "Margin loans up to 1 month salary",
    body: "KYC-verified employment lending with a spend-versus-invested breakdown inside the platform.",
  },
];

const stats = [
  { value: "0%", label: "Fee on profitable trades" },
  { value: "3%", label: "Max loss-case insurance fee" },
  { value: "T-1", label: "Rumors published one trading day early" },
  { value: "4", label: "Accepted broker license types" },
];

function Home() {
  return (
    <>
      <section className="hero-glow relative overflow-visible border-b border-border/70">
        <div className="mx-auto grid max-w-7xl items-center gap-12 overflow-visible px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div className="relative z-10">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Capital protection, not promises
            </Badge>
            <h1 className="mt-6 text-4xl leading-[1.05] font-semibold sm:text-6xl">
              The investment platform that only earns when{" "}
              <span className="text-gradient">you don't lose</span>.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Pivoton filters recommendations heated across certified brokerage firms, verifies them
              with AI, and lets you deposit into guaranteed positions one trading day before the
              crowd. No fee on profitable trades.
            </p>
            <div className="mt-9">
              <LiquidGlassCapsule
                primary={{
                  label: "Explore the marketplace",
                  to: "/marketplace",
                  search: { tab: "deals" },
                  variant: "primary",
                  icon: ArrowRight,
                }}
                secondary={{
                  label: "See premium plans",
                  to: "/pricing",
                  variant: "outline",
                }}
              />
            </div>
          </div>

          <div className="relative z-[1] flex items-center justify-end overflow-visible lg:pr-0 xl:-mr-6">
            <HeroRobotAvatar />
          </div>
        </div>
      </section>

      <section className="border-b border-border/70">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border/70 px-5 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-background px-4 py-8">
              <div className="font-display text-3xl font-semibold text-primary">{s.value}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
          Six systems, one protected account
        </h2>
        <div className="mt-12 grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="bg-background p-7">
              <p.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/70">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="panel flex flex-col gap-6 p-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Insurance you only pay when it hurts</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                On guaranteed positions, a loss-case insurance fee of up to 3% of the covered amount
                is charged when a trade closes at a loss. Winning trades are charged nothing — no
                commission, no success fee.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/marketplace">Read the terms</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
