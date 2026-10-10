import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CallSummaryRecord } from "@/types/call-summary";

const LOCAL_KEY = "pivoton-call-summaries";

function readLocal(): CallSummaryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as CallSummaryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(records: CallSummaryRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}

function mapRow(row: Record<string, unknown>): CallSummaryRecord {
  let tickers: string[] = [];
  if (Array.isArray(row.extracted_tickers)) {
    tickers = row.extracted_tickers.map(String);
  } else if (typeof row.extracted_tickers === "string") {
    try {
      tickers = JSON.parse(row.extracted_tickers) as string[];
    } catch {
      tickers = [];
    }
  }

  return {
    id: String(row.id),
    room_id: String(row.room_id),
    broker_name: String(row.broker_name),
    user_id: String(row.user_id),
    full_transcript: String(row.full_transcript ?? ""),
    summary_markdown: String(row.summary_markdown ?? ""),
    extracted_tickers: tickers,
    duration_seconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    created_at: String(row.created_at),
  };
}

function mergeRecords(remote: CallSummaryRecord[], local: CallSummaryRecord[]): CallSummaryRecord[] {
  const map = new Map<string, CallSummaryRecord>();
  for (const r of remote) map.set(r.id, r);
  for (const r of local) map.set(r.id, r);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function saveCallSummary(input: {
  room_id: string;
  broker_name: string;
  user_id: string;
  full_transcript: string;
  summary_markdown: string;
  extracted_tickers: string[];
  duration_seconds?: number | null;
}): Promise<CallSummaryRecord> {
  const id = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("call_summaries")
      .insert({
        id,
        room_id: input.room_id,
        broker_name: input.broker_name,
        user_id: input.user_id,
        full_transcript: input.full_transcript,
        summary_markdown: input.summary_markdown,
        extracted_tickers: input.extracted_tickers,
        duration_seconds: input.duration_seconds ?? null,
      })
      .select("*")
      .single();

    if (!error && data) {
      const saved = mapRow(data);
      const local = readLocal();
      local.unshift(saved);
      writeLocal(local);
      return saved;
    }
  }

  const record: CallSummaryRecord = {
    id,
    room_id: input.room_id,
    broker_name: input.broker_name,
    user_id: input.user_id,
    full_transcript: input.full_transcript,
    summary_markdown: input.summary_markdown,
    extracted_tickers: input.extracted_tickers,
    duration_seconds: input.duration_seconds ?? null,
    created_at: new Date().toISOString(),
  };

  const local = readLocal();
  local.unshift(record);
  writeLocal(local);
  return record;
}

export async function fetchCallSummariesForRoom(roomId: string): Promise<CallSummaryRecord[]> {
  const local = readLocal().filter((r) => r.room_id === roomId);
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("call_summaries")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return mergeRecords(data.map(mapRow), local).filter((r) => r.room_id === roomId);
    }
  }

  return local.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function countCallSummariesForRoom(roomId: string): Promise<number> {
  const records = await fetchCallSummariesForRoom(roomId);
  return records.length;
}

export function getStorageMode(): "supabase" | "local" {
  return isSupabaseConfigured ? "supabase" : "local";
}
