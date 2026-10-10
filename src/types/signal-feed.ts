export type RecommendationStatus = "IN_PROGRESS" | "PURCHASED" | "CLOSED";

export type AiConfidence = "high" | "medium" | "low";

export interface SignalAiAnalysis {
  purchaseWindow: string;
  purchaseWindowDetail: string;
  profitProjection: string;
  confidence: AiConfidence;
}

export interface SignalRecommendation {
  id: string;
  roomId: string;
  brokerKey: string;
  brokerName: string;
  brokerTitle: string;
  brokerLicense: string;
  ticker: string;
  purchasePrice: number;
  stopLoss: number;
  targetProfit: number;
  status: RecommendationStatus;
  createdAt: string;
  closedAt?: string;
  closePrice?: number;
  aiAnalysis?: SignalAiAnalysis | null;
  aiAnalysisStatus?: "pending" | "ready" | "error";
}

export function getBrokerKey(displayName: string): string {
  const key = displayName.trim().toLowerCase().replace(/\s+/g, "-");
  return key || "anonymous-broker";
}

export function isRecommendationOwner(
  rec: SignalRecommendation,
  brokerKey: string,
  displayName: string,
): boolean {
  if (brokerKey && rec.brokerKey) return rec.brokerKey === brokerKey;
  return rec.brokerName.trim().toLowerCase() === displayName.trim().toLowerCase();
}
