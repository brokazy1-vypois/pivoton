import {
  buildGoogleCalendarTemplateUrl,
  createGoogleCalendarEventServer,
  exchangeGoogleCalendarOAuthCodeServer,
  getGoogleCalendarOAuthAuthorizeUrlServer,
} from "@/lib/google-calendar.server";
import { generateHangoutAgendaServer } from "@/lib/hangout-planner.server";
import type { HangoutAgendaDraft, HangoutFriend, HangoutVenue } from "@/types/hangout";

export async function generateHangoutAgenda(input: {
  venue: HangoutVenue;
  scheduledAt: string;
  friends: HangoutFriend[];
  hostName: string;
}): Promise<HangoutAgendaDraft> {
  return generateHangoutAgendaServer({ data: input });
}

export async function getGoogleCalendarOAuthAuthorizeUrl(
  userId: string,
  returnTo = "/feed",
): Promise<{ url: string; state: string }> {
  return getGoogleCalendarOAuthAuthorizeUrlServer({ data: { userId, returnTo } });
}

export async function exchangeGoogleCalendarOAuthCode(code: string, state: string) {
  return exchangeGoogleCalendarOAuthCodeServer({ data: { code, state } });
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  venue: HangoutVenue;
  agenda: HangoutAgendaDraft;
  scheduledAt: string;
  timeZone: string;
  friends: HangoutFriend[];
}) {
  return createGoogleCalendarEventServer({ data: input });
}

export { buildGoogleCalendarTemplateUrl };
