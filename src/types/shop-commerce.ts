export interface UserBalance {
  user_id: string;
  monthly_salary: number;
  disbursed_loan_balance: number;
  spent_via_pos: number;
  under_investment: number;
  /** ACH / Plaid deposits minus withdrawals (external wallet cash). */
  wallet_cash: number;
  /** Tracked investment profits credited to the wallet. */
  cumulative_yield: number;
  available_balance: number;
  labor_contract_verified: boolean;
  updated_at?: string;
}

export interface SupabaseOrderRow {
  id: string;
  user_id: string;
  erp_order_id: string;
  pivoton_sku: string;
  product_name: string;
  product_image: string | null;
  total_price: number;
  payment_method: string;
  status: string;
  tracking_number: string | null;
  shipping_address: Record<string, string>;
  created_at: string;
}

export const DEFAULT_UNDER_INVESTMENT = 2100;
export const DEFAULT_SPENT_VIA_POS = 640;

export function computeAvailableBalance(input: {
  disbursed_loan_balance: number;
  spent_via_pos: number;
  under_investment: number;
  wallet_cash?: number;
}): number {
  return Math.max(
    0,
    Math.round(
      (input.disbursed_loan_balance +
        (input.wallet_cash ?? 0) -
        input.spent_via_pos -
        input.under_investment) *
        100,
    ) / 100,
  );
}

export function computePortfolioTotal(input: {
  available_balance: number;
  under_investment: number;
  cumulative_yield?: number;
}): number {
  return Math.round((input.available_balance + input.under_investment + (input.cumulative_yield ?? 0)) * 100) / 100;
}
