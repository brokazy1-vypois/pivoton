import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/server-env";
import type { HangoutAgendaDraft, HangoutFriend, HangoutVenue } from "@/types/hangout";

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

function parseAgendaJson(text: string): HangoutAgendaDraft | null {
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as HangoutAgendaDraft;
    if (!parsed.title || !parsed.invitationText) return null;
    return {
      title: parsed.title,
      invitationText: parsed.invitationText,
      agendaNotes: parsed.agendaNotes ?? parsed.invitationText,
    };
  } catch {
    return null;
  }
}

function buildFallbackAgenda(
  venue: HangoutVenue,
  scheduledAt: string,
  friends: HangoutFriend[],
): HangoutAgendaDraft {
  const when = new Date(scheduledAt);
  const friendNames = friends.map((friend) => friend.full_name).join(", ") || "friends";
  const timeLabel = when.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    title: `Hangout at ${venue.name}`,
    invitationText: `Let's meet at ${venue.name} on ${timeLabel}. ${venue.description}`,
    agendaNotes: [
      `Venue: ${venue.name}`,
      `Address: ${venue.address}`,
      `When: ${timeLabel}`,
      `Guests: ${friendNames}`,
      "",
      "Suggested flow:",
      "• Arrive and grab a spot",
      "• Catch up on recent hopes and projects",
      "• Walk the neighborhood if the weather is nice",
    ].join("\n"),
  };
}

export const generateHangoutAgendaServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<HangoutAgendaDraft> => {
    const data = extractData(ctx);
    const venue = data.venue as HangoutVenue;
    const scheduledAt = String(data.scheduledAt ?? "");
    const friends = (data.friends as HangoutFriend[]) ?? [];
    const hostName = String(data.hostName ?? "You");

    if (!venue?.name || !scheduledAt) {
      throw new Error("Venue and scheduled time are required.");
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return buildFallbackAgenda(venue, scheduledAt, friends);
    }

    const friendSummary = friends
      .map((friend) => `${friend.full_name}${friend.region ? ` (${friend.region})` : ""}`)
      .join(", ");

    const prompt = `You are planning an offline friend hangout for a social community app.

Return ONLY valid JSON:
{
  "title": "short calendar event title",
  "invitationText": "warm 2-3 sentence invite message",
  "agendaNotes": "bullet-style meeting agenda with 3-5 items tailored to the venue"
}

Venue name: ${venue.name}
Venue category: ${venue.category ?? "local spot"}
Venue address: ${venue.address}
Venue description: ${venue.description}
Host: ${hostName}
Friends invited: ${friendSummary || "close friends from the network"}
Scheduled ISO time: ${scheduledAt}

Make the agenda location-aware (food, coffee, walk, views, etc.) and friendly.`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const text = response.text ?? "";
      const parsed = parseAgendaJson(text);
      if (parsed) return parsed;
    } catch {
      // Fall through to deterministic copy.
    }

    return buildFallbackAgenda(venue, scheduledAt, friends);
  },
);
