/** Deterministic mock base prices for demo P&L tracking */
const BASE_PRICES: Record<string, number> = {
  TSLA: 248.5,
  NVDA: 875.2,
  AAPL: 189.4,
  MSFT: 415.8,
  AMD: 162.3,
  META: 512.6,
  AMZN: 178.9,
  GOOGL: 171.2,
  SPY: 548.3,
  QQQ: 468.7,
};

export function normalizeTicker(ticker: string): string {
  return ticker.replace(/^\$/, "").trim().toUpperCase();
}

export function getBasePrice(ticker: string): number {
  const key = normalizeTicker(ticker);
  if (BASE_PRICES[key]) return BASE_PRICES[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return 50 + (Math.abs(hash) % 450);
}

/** Simulates live price with small random walk from base */
export function getLivePrice(ticker: string, seed = 0): number {
  const base = getBasePrice(ticker);
  const drift = Math.sin(Date.now() / 60000 + seed) * 0.012;
  const noise = Math.sin(Date.now() / 8000 + seed * 1.7) * 0.004;
  return Number((base * (1 + drift + noise)).toFixed(2));
}

export function calcPnLPercent(purchasePrice: number, currentPrice: number): number {
  if (!purchasePrice) return 0;
  return Number((((currentPrice - purchasePrice) / purchasePrice) * 100).toFixed(1));
}
