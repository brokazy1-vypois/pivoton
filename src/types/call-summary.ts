export interface CallSummaryRecord {
  id: string;
  room_id: string;
  broker_name: string;
  user_id: string;
  full_transcript: string;
  summary_markdown: string;
  extracted_tickers: string[];
  duration_seconds: number | null;
  created_at: string;
}

/** Stable slug for private room IDs in storage. */
export function roomIdFromName(roomName: string): string {
  return roomName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
