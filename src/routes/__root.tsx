import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GrowthBookAppProvider } from "@/components/providers/GrowthBookAppProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { ChatProvider } from "@/context/ChatContext";
import { HangoutProvider } from "@/context/HangoutContext";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { HangoutSchedulingModal } from "@/components/hangout/HangoutSchedulingModal";
import { PeerCallModal } from "@/components/chat/PeerCallModal";
import { PremiumCallUpgradeModal } from "@/components/chat/PremiumCallUpgradeModal";
import { AuthProvider } from "@/context/AuthContext";
import { UserGoalHydrationBridge } from "@/components/providers/UserGoalHydrationBridge";
import { ProfileAvatarProvider } from "@/context/ProfileAvatarContext";
import { UserBalanceProvider } from "@/context/UserBalanceContext";
import { TradingGatewayProvider } from "@/context/TradingGatewayContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { LiquidGlassTransitionLayout } from "@/components/ui/liquid-glass";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Pivoton" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <GrowthBookAppProvider>
        <AuthProvider>
          <UserGoalHydrationBridge />
          <ProfileAvatarProvider>
          <ChatProvider>
            <HangoutProvider>
              <UserBalanceProvider>
                <TradingGatewayProvider>
                  <LiquidGlassTransitionLayout>
                  <div id="app-root" className="flex min-h-screen flex-col">
                    <SiteHeader />
                    <main className="flex-1">
                      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                      <Outlet />
                    </main>
                    <SiteFooter />
                  </div>
                  <AuthModal />
                  <ChatDrawer />
                  <PeerCallModal />
                  <PremiumCallUpgradeModal />
                  <HangoutSchedulingModal />
                  <Toaster position="top-center" />
                  <Analytics />
                  <SpeedInsights />
                  </LiquidGlassTransitionLayout>
                </TradingGatewayProvider>
              </UserBalanceProvider>
            </HangoutProvider>
          </ChatProvider>
          </ProfileAvatarProvider>
        </AuthProvider>
      </GrowthBookAppProvider>
    </QueryClientProvider>
  );
}

