import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-sm font-semibold">Pivoton</div>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            AI-driven capital protection. No fee on profitable trades. Insurance fee applies only on
            guaranteed trades that close at a loss, capped at 3%.
          </p>
        </div>
        <div className="flex gap-5 text-xs text-muted-foreground">
          <Link to="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <Link to="/loans" className="hover:text-foreground">
            Loans
          </Link>
        </div>
      </div>
    </footer>
  );
}
