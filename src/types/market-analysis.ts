export interface MarketplaceRumor {
  id: string;
  sector: string;
  index: string;
  conviction: number;
  firms: number;
  cap: string;
  window: string;
  trend: number[];
  assetLabel: string;
}

export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  time: string;
  value: number;
}

export interface MacdPoint {
  time: string;
  macd: number;
  signal: number;
  histogram: number;
}

export interface MarketFundamentals {
  peRatio?: number;
  debtToEquity?: number;
  latestClose?: number;
  changePercent?: number;
}

export interface AnalysisSections {
  executiveSummary: string;
  technicalAnalysis: string;
  financialHealth: string;
  targetEntry: string;
}

export interface TechnicalSnapshot {
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  sma50?: number;
  sma200?: number;
  momentumLabel: string;
  macdBias: string;
}

export interface RiskSnapshot {
  score: number;
  label: string;
  depositGuarantee: string;
}

export interface AnonymizedMarketAnalysis {
  refCode: string;
  assetLabel: string;
  sector: string;
  index: string;
  conviction: number;
  depositCap: string;
  candles: CandlePoint[];
  sma50: IndicatorPoint[];
  sma200: IndicatorPoint[];
  rsi: IndicatorPoint[];
  macd: MacdPoint[];
  fundamentals: MarketFundamentals;
  sections: AnalysisSections;
  technical: TechnicalSnapshot;
  risk: RiskSnapshot;
  suggestedEntryPrice?: number;
  fetchedAt: string;
}

export type ChartViewMode = "candlestick" | "area";
