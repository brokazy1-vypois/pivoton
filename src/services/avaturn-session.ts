import { createAvaturnSessionServer } from "@/lib/avaturn.server";
import { getAvaturnUrl } from "@/lib/avaturn-env";

const AVATURN_USER_ID_KEY = "pivoton-avaturn-user-ids";

function readAvaturnUserMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AVATURN_USER_ID_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAvaturnUserMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AVATURN_USER_ID_KEY, JSON.stringify(map));
}

export function readStoredAvaturnUserId(pivotonUserId: string): string | null {
  return readAvaturnUserMap()[pivotonUserId] ?? null;
}

export function writeStoredAvaturnUserId(pivotonUserId: string, avaturnUserId: string) {
  writeAvaturnUserMap({ ...readAvaturnUserMap(), [pivotonUserId]: avaturnUserId });
}

export interface AvaturnEditorSession {
  url: string;
  avaturnUserId: string | null;
  source: "api" | "subdomain";
}

export async function createAvaturnEditorSession(
  pivotonUserId: string,
): Promise<AvaturnEditorSession> {
  const avaturnUserId = readStoredAvaturnUserId(pivotonUserId);

  try {
    const result = await createAvaturnSessionServer({
      data: { pivotonUserId, avaturnUserId },
    });

    if (result.avaturnUserId) {
      writeStoredAvaturnUserId(pivotonUserId, result.avaturnUserId);
    }

    return {
      url: result.url,
      avaturnUserId: result.avaturnUserId,
      source: result.source,
    };
  } catch (error) {
    console.warn("[Avaturn] Session API unavailable, using subdomain fallback.", error);
    return {
      url: getAvaturnUrl(),
      avaturnUserId,
      source: "subdomain",
    };
  }
}
