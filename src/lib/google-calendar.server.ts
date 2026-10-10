import { createServerFn } from "@tanstack/react-start";
import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthRedirectUri,
  isGoogleCalendarOAuthConfigured,
} from "@/lib/server-env";
import type { HangoutAgendaDraft, HangoutFriend, HangoutVenue } from "@/types/hangout";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface GoogleOAuthStatePayload {
  userId: string;
  returnTo: string;
  nonce: string;
}

function extractData(ctx: unknown): Record<string, unknown> {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  return {};
}

export function encodeGoogleOAuthState(payload: GoogleOAuthStatePayload): string {
  return btoa(JSON.stringify(payload));
}

export function decodeGoogleOAuthState(raw: string): GoogleOAuthStatePayload | null {
  try {
    const parsed = JSON.parse(atob(raw)) as GoogleOAuthStatePayload;
    if (!parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireGoogleOAuthConfig() {
  if (!isGoogleCalendarOAuthConfigured()) {
    throw new Error(
      "Google Calendar OAuth is not configured. Set NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }
}

export const getGoogleCalendarOAuthAuthorizeUrlServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ url: string; state: string }> => {
    requireGoogleOAuthConfig();

    const data = extractData(ctx);
    const userId = String(data.userId ?? "").trim();
    const returnTo = String(data.returnTo ?? "/feed").trim() || "/feed";
    if (!userId) throw new Error("User id is required for Google OAuth.");

    const state = encodeGoogleOAuthState({
      userId,
      returnTo,
      nonce: crypto.randomUUID(),
    });

    const params = new URLSearchParams({
      client_id: getGoogleOAuthClientId(),
      redirect_uri: getGoogleOAuthRedirectUri(),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return { url: `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`, state };
  },
);

export const exchangeGoogleCalendarOAuthCodeServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    scope: string | null;
    userId: string;
    returnTo: string;
  }> => {
    requireGoogleOAuthConfig();

    const data = extractData(ctx);
    const code = String(data.code ?? "").trim();
    const stateRaw = String(data.state ?? "").trim();
    if (!code || !stateRaw) throw new Error("Missing Google OAuth callback parameters.");

    const state = decodeGoogleOAuthState(stateRaw);
    if (!state) throw new Error("Invalid Google OAuth state.");

    const body = new URLSearchParams({
      code,
      client_id: getGoogleOAuthClientId(),
      client_secret: getGoogleOAuthClientSecret(),
      redirect_uri: getGoogleOAuthRedirectUri(),
      grant_type: "authorization_code",
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Google OAuth token exchange failed.");
    }

    const token = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    if (!token.access_token) throw new Error("Google OAuth did not return an access token.");

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresIn: token.expires_in ?? null,
      scope: token.scope ?? null,
      userId: state.userId,
      returnTo: state.returnTo,
    };
  },
);

export const createGoogleCalendarEventServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<{ eventId: string; htmlLink: string | null }> => {
    const data = extractData(ctx);
    const accessToken = String(data.accessToken ?? "").trim();
    const venue = data.venue as HangoutVenue;
    const agenda = data.agenda as HangoutAgendaDraft;
    const scheduledAt = String(data.scheduledAt ?? "");
    const timeZone = String(data.timeZone ?? "UTC");
    const friends = (data.friends as HangoutFriend[]) ?? [];

    if (!accessToken) throw new Error("Google Calendar access token is required.");
    if (!venue?.name || !agenda?.title || !scheduledAt) {
      throw new Error("Venue, agenda, and scheduled time are required.");
    }

    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const attendees = friends
      .filter((friend) => friend.email)
      .map((friend) => ({ email: friend.email! }));

    const response = await fetch(`${CALENDAR_EVENTS_URL}?sendUpdates=all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: agenda.title,
        description: `${agenda.invitationText}\n\n${agenda.agendaNotes}`,
        location: venue.address,
        start: {
          dateTime: start.toISOString(),
          timeZone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone,
        },
        attendees,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to create Google Calendar event.");
    }

    const event = (await response.json()) as { id?: string; htmlLink?: string };
    return {
      eventId: event.id ?? crypto.randomUUID(),
      htmlLink: event.htmlLink ?? null,
    };
  },
);

export function buildGoogleCalendarTemplateUrl(input: {
  title: string;
  details: string;
  location: string;
  scheduledAt: string;
  durationMinutes?: number;
}): string {
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60 * 1000);

  const format = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    details: input.details,
    location: input.location,
    dates: `${format(start)}/${format(end)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
