import type { GeoCoordinate } from "@/lib/hope-geo";

export interface HangoutFriend {
  user_id: string;
  full_name: string;
  avatar: string;
  email: string | null;
  region: string | null;
}

export interface HangoutVenue {
  id: string;
  name: string;
  description: string;
  address: string;
  category: string | null;
  coordinate: GeoCoordinate;
  photoUrl: string | null;
  mapboxFeatureId?: string | null;
}

export interface HangoutAgendaDraft {
  title: string;
  invitationText: string;
  agendaNotes: string;
}

export interface HangoutScheduleInput {
  venue: HangoutVenue;
  scheduledAt: string;
  timeZone: string;
  friends: HangoutFriend[];
}

export interface GoogleCalendarTokenRecord {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scope?: string | null;
  connectedAt: string;
}
