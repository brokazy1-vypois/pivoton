import { GrowthBook } from "@growthbook/growthbook";

/** https://cdn.growthbook.io/api/features/sdk-XWDjTbpyn8QL9S0 */
export const GROWTHBOOK_API_HOST = "https://cdn.growthbook.io";
export const GROWTHBOOK_CLIENT_KEY = "sdk-XWDjTbpyn8QL9S0";

const apiHost = import.meta.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? GROWTHBOOK_API_HOST;
const clientKey = import.meta.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? GROWTHBOOK_CLIENT_KEY;

export const growthbookFeaturesUrl = `${apiHost}/api/features/${clientKey}`;

export const growthbook = new GrowthBook({
  apiHost,
  clientKey,
  enableDevMode: import.meta.env.DEV,
  trackingCallback: (experiment, result) => {
    console.log("Experiment viewed", {
      experimentId: experiment.key,
      variationId: result.key,
    });

    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "experiment_viewed", {
        experiment_id: experiment.key,
        variation_id: result.key,
      });
    }
  },
});

export function isGrowthBookConfigured(): boolean {
  return Boolean(apiHost && clientKey);
}
