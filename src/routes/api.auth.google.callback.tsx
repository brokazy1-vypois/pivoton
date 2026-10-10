import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exchangeGoogleCalendarOAuthCode } from "@/services/hangout";
import { saveGoogleCalendarToken } from "@/services/google-calendar-tokens";

export const Route = createFileRoute("/api/auth/google/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: GoogleOAuthCallbackPage,
});

function GoogleOAuthCallbackPage() {
  const navigate = useNavigate();
  const { code, state, error } = Route.useSearch();
  const [message, setMessage] = useState("Connecting Google Calendar…");

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      if (error) {
        toast.error("Google Calendar connection was cancelled or failed.");
        await navigate({ to: "/feed", replace: true });
        return;
      }

      if (!code || !state) {
        toast.error("Missing Google OAuth callback parameters.");
        await navigate({ to: "/feed", replace: true });
        return;
      }

      try {
        setMessage("Exchanging Google OAuth token…");
        const result = await exchangeGoogleCalendarOAuthCode(code, state);
        if (cancelled) return;

        saveGoogleCalendarToken({
          userId: result.userId,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresIn
            ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
            : null,
          scope: result.scope,
          connectedAt: new Date().toISOString(),
        });

        toast.success("Google Calendar connected", {
          description: "You can now sync Hangout events and send invites.",
        });

        await navigate({ to: result.returnTo || "/feed", replace: true });
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Google OAuth exchange failed");
        await navigate({ to: "/feed", replace: true });
      }
    };

    void finish();

    return () => {
      cancelled = true;
    };
  }, [code, error, navigate, state]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#0B132B] px-5">
      <div className="panel flex flex-col items-center gap-3 p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#00E599]" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
