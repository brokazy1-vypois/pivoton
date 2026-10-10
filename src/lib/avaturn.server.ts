import { createServerFn } from "@tanstack/react-start";
import { getAvaturnUrl } from "@/lib/avaturn-env";
import { getServerEnv } from "@/lib/server-env";

const DEFAULT_AVATURN_API_BASE = "https://api.avaturn.me";

interface CreateAvaturnSessionInput {
  pivotonUserId: string;
  avaturnUserId?: string | null;
}

interface CreateAvaturnSessionResult {
  url: string;
  avaturnUserId: string | null;
  sessionId?: string | null;
  source: "api" | "subdomain";
}

function getAvaturnApiKey(): string {
  return getServerEnv("AVATURN_API_KEY", "AVATURN_ACCESS_TOKEN");
}

function getAvaturnApiBase(): string {
  return getServerEnv("AVATURN_API_BASE_URL") || DEFAULT_AVATURN_API_BASE;
}

function extractSessionInput(ctx: unknown): CreateAvaturnSessionInput {
  if (ctx && typeof ctx === "object" && "data" in ctx) {
    const data = (ctx as { data: unknown }).data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const pivotonUserId = typeof record.pivotonUserId === "string" ? record.pivotonUserId : "";
      const avaturnUserId =
        typeof record.avaturnUserId === "string" ? record.avaturnUserId : null;
      if (pivotonUserId) {
        return { pivotonUserId, avaturnUserId };
      }
    }
  }
  throw new Error("Invalid Avaturn session payload.");
}

async function avaturnApiPost<T>(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${getAvaturnApiBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Avaturn API ${path} failed (${response.status}): ${detail.slice(0, 240)}`,
    );
  }

  return (await response.json()) as T;
}

function readUserId(payload: Record<string, unknown>): string | null {
  const candidates = [payload.id, payload.user_id, payload.userId];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function readSessionUrl(payload: Record<string, unknown>): string | null {
  const candidates = [payload.url, payload.session_url, payload.link];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export const createAvaturnSessionServer = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<CreateAvaturnSessionResult> => {
    const { avaturnUserId: existingAvaturnUserId } = extractSessionInput(ctx);
    const apiKey = getAvaturnApiKey();

    if (!apiKey) {
      return {
        url: getAvaturnUrl(),
        avaturnUserId: existingAvaturnUserId ?? null,
        source: "subdomain",
      };
    }

    let avaturnUserId = existingAvaturnUserId ?? null;

    if (!avaturnUserId) {
      const userPayload = await avaturnApiPost<Record<string, unknown>>(
        "/api/v1/users/new",
        apiKey,
        {},
      );
      avaturnUserId = readUserId(userPayload);
      if (!avaturnUserId) {
        throw new Error("Avaturn API did not return a user id.");
      }
    }

    const sessionPayload = await avaturnApiPost<Record<string, unknown>>(
      "/api/v1/sessions/new",
      apiKey,
      {
        user_id: avaturnUserId,
        config: {
          type: "create_or_edit_existing",
        },
      },
    );

    const url = readSessionUrl(sessionPayload);
    if (!url) {
      throw new Error("Avaturn API did not return a session URL.");
    }

    const sessionId =
      typeof sessionPayload.session_id === "string"
        ? sessionPayload.session_id
        : typeof sessionPayload.id === "string"
          ? sessionPayload.id
          : null;

    return {
      url,
      avaturnUserId,
      sessionId,
      source: "api",
    };
  },
);
