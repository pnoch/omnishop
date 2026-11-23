import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { router, usePathname } from "expo-router";
import { log } from "@shared/log";
import { hasSeenOnboarding, isPublicRoute } from "@/lib/onboarding";
import { getWatchlist, updateProductListings } from "@/lib/storage";
import { notificationRouteFor } from "@/lib/notification-routing";

export function useOnboardingGate({
  rootNavigationReadyRef,
  pendingRouteRef,
}: {
  rootNavigationReadyRef: MutableRefObject<boolean>;
  pendingRouteRef: MutableRefObject<
    ReturnType<typeof notificationRouteFor> | "/(tabs)" | null
  >;
}) {
  const [onboardingState, setOnboardingState] = useState<
    "checking" | "app" | "intro"
  >("checking");
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    void hasSeenOnboarding().then((seen) =>
      setOnboardingState(seen ? "app" : "intro"),
    );
  }, []);

  useEffect(() => {
    if (onboardingState !== "app") return;
    rootNavigationReadyRef.current = true;
    const pending = pendingRouteRef.current;
    if (pending) {
      pendingRouteRef.current = null;
      const t = setTimeout(() => router.push(pending), 0);
      return () => clearTimeout(t);
    }
  }, [onboardingState, rootNavigationReadyRef, pendingRouteRef]);

  const launchCheckRanRef = useRef(false);
  useEffect(() => {
    if (onboardingState !== "app" || launchCheckRanRef.current) return;
    launchCheckRanRef.current = true;
    // Load the scraper stack after the shell renders; it is a launch extra, not
    // part of the first paint.
    void import("@/lib/background-price-check")
      .then((m) => m.checkPriceDropsNow())
      .catch((e) => log.error("[Launch] price check failed", e));
    void (async () => {
      const [{ rediscoverMissingListings }, { discoverListings }] =
        await Promise.all([
          import("@/lib/manual-add"),
          import("@/lib/listing-discovery"),
        ]);
      await rediscoverMissingListings({
        storage: { getWatchlist, updateProductListings },
        discover: discoverListings,
      });
    })().catch((e) =>
      log.error("[Launch] missing-listings discovery failed", e),
    );
  }, [onboardingState]);

  return { onboardingState, setOnboardingState, isPublic };
}
