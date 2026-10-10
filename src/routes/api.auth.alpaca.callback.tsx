import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exchangeAlpacaOAuthCode } from "@/services/alpaca-gateway";
import { saveAlpacaOAuthToken } from "@/services/alpaca-oauth-tokens";

export const Route = createFileRoute("/api/auth/alpaca/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: AlpacaOAuthCallbackPage,
});

function AlpacaOAuthCallbackPage() {
  const navigate = useNavigate();
  const { code, state, error } = Route.useSearch();
  const [message, setMessage] = useState("Completing Alpaca OAuth connection…");

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      if (error) {
        toast.error("Alpaca OAuth was cancelled or failed.");
        await navigate({ to: "/marketplace", search: { tab: "gateways" }, replace: true });
        return;
      }

      if (!code || !state) {
        toast.error("Missing Alpaca OAuth callback parameters.");
        await navigate({ to: "/marketplace", search: { tab: "gateways" }, replace: true });
        return;
      }

      try {
        setMessage("Exchanging OAuth token with Alpaca…");
        const result = await exchangeAlpacaOAuthCode(code, state);
        if (cancelled) return;

        saveAlpacaOAuthToken({
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          gatewayId: result.gatewayId,
          userId: result.userId,
          connectedAt: new Date().toISOString(),
        });

        toast.success("Alpaca OAuth connected", {
          description: "Gateway mapped to Alpaca order routing engine.",
        });

        await navigate({
          to: "/marketplace",
          search: { tab: "gateways", oauth: "success", gateway: result.gatewayId },
          replace: true,
        });
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Alpaca OAuth exchange failed");
        await navigate({ to: "/marketplace", search: { tab: "gateways" }, replace: true });
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
