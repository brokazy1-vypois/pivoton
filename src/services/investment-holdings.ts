import type { InvestmentHolding } from "@/types/trading-gateway";

const LOCAL_HOLDINGS_PREFIX = "pivoton-investment-holdings";

function localKey(userId: string): string {
  return `${LOCAL_HOLDINGS_PREFIX}_${userId}`;
}

function readLocalHoldings(userId: string): InvestmentHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? (JSON.parse(raw) as InvestmentHolding[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHoldings(userId: string, holdings: InvestmentHolding[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localKey(userId), JSON.stringify(holdings));
}

export async function listInvestmentHoldings(userId: string): Promise<InvestmentHolding[]> {
  return readLocalHoldings(userId);
}

export async function addInvestmentHolding(
  userId: string,
  holding: InvestmentHolding,
): Promise<InvestmentHolding[]> {
  const current = readLocalHoldings(userId);
  const next = [holding, ...current];
  writeLocalHoldings(userId, next);
  return next;
}

/** Whether the user has locked marketplace reserves routed through a gateway. */
export function hasActiveReservesForGateway(userId: string, gatewayId: string): boolean {
  return getActiveReserveAmountByGateway(userId, gatewayId) > 0;
}

/** Sum of locked reserve amounts allocated through a specific gateway. */
export function getActiveReserveAmountByGateway(userId: string, gatewayId: string): number {
  return readLocalHoldings(userId).reduce((sum, holding) => {
    const gatewayAmount = holding.allocations
      .filter((allocation) => allocation.gatewayId === gatewayId)
      .reduce((total, allocation) => total + allocation.amount, 0);
    return sum + gatewayAmount;
  }, 0);
}

/** Remove gateway allocations from holdings and return the total released amount. */
export async function releaseGatewayReserves(
  userId: string,
  gatewayId: string,
): Promise<{ releasedAmount: number }> {
  const holdings = readLocalHoldings(userId);
  let releasedAmount = 0;
  const nextHoldings: InvestmentHolding[] = [];

  for (const holding of holdings) {
    const gatewayAllocations = holding.allocations.filter(
      (allocation) => allocation.gatewayId === gatewayId,
    );
    const remainingAllocations = holding.allocations.filter(
      (allocation) => allocation.gatewayId !== gatewayId,
    );
    const gatewayTotal = gatewayAllocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    );

    if (gatewayTotal === 0) {
      nextHoldings.push(holding);
      continue;
    }

    releasedAmount += gatewayTotal;

    if (remainingAllocations.length === 0) continue;

    nextHoldings.push({
      ...holding,
      totalAmount: remainingAllocations.reduce(
        (total, allocation) => total + allocation.amount,
        0,
      ),
      allocations: remainingAllocations,
    });
  }

  writeLocalHoldings(userId, nextHoldings);
  return { releasedAmount: Math.round(releasedAmount * 100) / 100 };
}
