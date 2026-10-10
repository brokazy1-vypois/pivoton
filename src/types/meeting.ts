export type OrderType = "market" | "limit" | "stop" | "stop-limit" | "other";

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface FinancialInsight {
  id: string;
  ticker?: string;
  action?: "buy" | "sell" | "hold";
  entryPrice?: string;
  targetPrice?: string;
  stopLoss?: string;
  orderType?: OrderType;
  sentiment?: Sentiment;
  insight?: string;
  timestamp: number;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface MeetingSummary {
  tickers: string[];
  recommendations: {
    ticker: string;
    action: string;
    entry?: string;
    target?: string;
    stop?: string;
  }[];
  actionItems: string[];
  executiveSummary: string;
}

export interface BrokerRoom {
  broker: string;
  title: string;
  license: string;
  room: string;
  price: string;
  members: number;
  hit: string;
  calls: number;
}
