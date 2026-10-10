import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pivoton Premium — Subscription Plans for Investors & Brokers" },
      {
        name: "description",
        content:
          "Unlock broker track-record analytics, the finance AI agent, and the AI working dashboard. Monthly, quarterly and annual Pivoton cycles.",
      },
      { property: "og:title", content: "Pivoton Premium Plans" },
      {
        property: "og:description",
        content: "Premium cycles unlocking broker analytics, the AI finance agent and the AI dashboard.",
      },
    ],
  }),
  component: Pricing,
});

const plans = [
  {
    name: "Observer",
    price: "Free",
    cycle: "",
    blurb: "Browse rumors, follow brokers, post to the hope feed.",
    features: [
      "Hope timeline feed & profile",
      "Rumor list with hidden tickers",
      "Public broker leaderboard",
      "Pivoton wallet",
    ],
    cta: "Current plan",
    highlight: false,
  },
  {
    name: "Premium",
    price: "$39",
    cycle: "/ month cycle",
    blurb: "The full analyst toolkit for active investors.",
    features: [
      "Broker recommendation history & hit-rate statistics",
      "AI finance agent for Q&A and trade consultation",
      "AI working dashboard with auto-composed analysis",
      "Recommendation tracking from private rooms",
      "Live consultancy calls with brokers in session",
    ],
    cta: "Subscribe with card",
    highlight: true,
  },
  {
    name: "Broker Pro",
    price: "$89",
    cycle: "/ month cycle",
    blurb: "For KYC-verified brokers monetising their calls.",
    features: [
      "Everything in Premium",
      "Unlimited chargeable private rooms",
      "Room pricing & membership controls",
      "Payout dashboard for consultancy fees",
      "License badge on your public profile",
    ],
    cta: "Apply as broker",
    highlight: false,
  },
];

function Pricing() {
  const { user, upgradeToPremium, openAuthModal } = useAuth();

  const handlePlanClick = (planName: string, highlight: boolean) => {
    if (planName === "Premium" && highlight) {
      if (!user) {
        openAuthModal("Sign in to subscribe to Pivoton Premium.");
        return;
      }
      upgradeToPremium();
      toast.success("Pivoton Premium activated — unlimited AI finance agent unlocked", {
        description: "Card checkout will be wired when payments go live. Premium is active for this session.",
      });
      return;
    }

    toast("Card checkout coming soon", {
      description: `${planName} will be payable by credit or debit card once payments are switched on.`,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <div className="max-w-2xl">
        <Badge variant="outline" className="border-primary/40 text-primary">
          Subscription cycles
        </Badge>
        <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">Pay for the edge, not the trade</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Premium features unlock for the duration of a cycle and renew automatically. Trading
          profits are never taxed by Pivoton.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`panel flex flex-col p-8 ${plan.highlight ? "ring-1 ring-primary/50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              {plan.highlight && <Badge>Most popular</Badge>}
            </div>
            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.cycle}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{plan.blurb}</p>
            <ul className="mt-7 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-8"
              variant={plan.highlight ? "default" : "secondary"}
              onClick={() => handlePlanClick(plan.name, plan.highlight)}
            >
              <CreditCard className="mr-1.5 h-4 w-4" />
              {plan.name === "Premium" && user?.isPremium ? "Premium active" : plan.cta}
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Credit and debit cards will fund every in-app transaction: subscriptions, private room
        memberships, wallet deposits and loan repayments.
      </p>
    </div>
  );
}
