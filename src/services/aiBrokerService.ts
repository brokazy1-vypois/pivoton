import { processBrokerQueryServer } from "@/lib/ai-broker.server";

export async function processBrokerQuery(query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Empty query.");
  }

  const { response } = await processBrokerQueryServer({ data: { query: trimmed } });
  return response;
}
