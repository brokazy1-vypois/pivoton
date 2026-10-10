import {
  getActiveReserveAmountByGateway,
  releaseGatewayReserves,
} from "@/services/investment-holdings";
import { releaseReserveForInvestment } from "@/services/user-balances";

/** Release frozen reserves for a gateway and refund the user's available balance. */
export async function releaseGatewayReserveFunds(
  userId: string,
  gatewayId: string,
): Promise<{ releasedAmount: number }> {
  const { releasedAmount } = await releaseGatewayReserves(userId, gatewayId);
  if (releasedAmount > 0) {
    await releaseReserveForInvestment(userId, releasedAmount);
  }
  return { releasedAmount };
}

export { getActiveReserveAmountByGateway };
