import { ALPACA_EXCHANGE_VENUES, ALPACA_EXCHANGE_VENUE_COUNT } from "@/data/alpaca-exchanges";

const CATEGORY_LABELS = {
  "us-primary": "Primary US Stock Exchanges",
  "ats-regional": "Alternative Trading Systems & Regional",
  "crypto-liquidity": "Crypto Liquidity Venues",
} as const;

export function ExchangeRoutingPanel() {
  const grouped = ALPACA_EXCHANGE_VENUES.reduce<
    Record<string, typeof ALPACA_EXCHANGE_VENUES>
  >((acc, venue) => {
    const key = venue.category;
    acc[key] = acc[key] ?? [];
    acc[key].push(venue);
    return acc;
  }, {});

  return (
    <section className="mt-10 border-t border-border/60 pt-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Exchange &amp; liquidity routing network</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {ALPACA_EXCHANGE_VENUE_COUNT} legal asset venues synced via Alpaca smart order routing.
          These venues sit beneath your connected securities firm cards — orders auto-route across
          NASDAQ, NYSE, Cboe, IEX, and crypto liquidity partners.
        </p>
      </div>

      <div className="space-y-8">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((category) => {
          const venues = grouped[category] ?? [];
          if (venues.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {venues.map((venue) => (
                  <div
                    key={venue.id}
                    className="rounded-lg border border-border/60 bg-surface-2/20 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{venue.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-[#00E599]">
                        Synced
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{venue.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
