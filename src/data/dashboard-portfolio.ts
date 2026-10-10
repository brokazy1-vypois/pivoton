export type DashboardPosition = {
  name: string;
  value: string;
  change: string;
  up: boolean;
  covered: boolean;
};

export type DashboardBrokerCall = {
  broker: string;
  room: string;
  result: string;
  up: boolean;
  date: string;
};

export const DASHBOARD_PORTFOLIO = {
  protectionPercent: 86,
  protectionNote:
    "Covered positions charge an insurance fee of up to 3% only when they close at a loss.",
  positions: [
    {
      name: "Guaranteed ETF ladder A",
      value: "$8,420",
      change: "+4.2%",
      up: true,
      covered: true,
    },
    {
      name: "Semiconductor rumor RM-4471",
      value: "$3,100",
      change: "+1.8%",
      up: true,
      covered: true,
    },
    {
      name: "Regional banking swing",
      value: "$1,240",
      change: "-2.1%",
      up: false,
      covered: false,
    },
  ] satisfies DashboardPosition[],
  brokerCalls: [
    {
      broker: "Marisol Vega",
      room: "Pre-open Momentum",
      result: "+6.4%",
      up: true,
      date: "Mar 12",
    },
    {
      broker: "Daniel Okafor",
      room: "Hedged ETF Rotations",
      result: "+2.1%",
      up: true,
      date: "Mar 11",
    },
    {
      broker: "Hana Ito",
      room: "Small Cap Rumor Desk",
      result: "-1.3%",
      up: false,
      date: "Mar 10",
    },
  ] satisfies DashboardBrokerCall[],
};

export function buildPortfolioContext(): string {
  const { protectionPercent, positions, brokerCalls } = DASHBOARD_PORTFOLIO;

  const positionLines = positions
    .map(
      (p) =>
        `- ${p.name}: ${p.value} | ${p.change} | ${p.covered ? "Covered (max 3% loss fee)" : "Uncovered"}`,
    )
    .join("\n");

  const callLines = brokerCalls
    .map((c) => `- ${c.broker} — ${c.room} (${c.date}): ${c.result}`)
    .join("\n");

  return `ACTIVE USER PORTFOLIO CONTEXT (use when answering position-specific questions):
- Protection status: ${protectionPercent}% of portfolio in covered positions
- Open positions:
${positionLines}
- Tracked broker calls:
${callLines}`;
}
