import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// Reanimated's useReducedMotion is a one-line platform check, but importing it
// pulls the whole animation library into the shared web chunk. This keeps the
// same behaviour (live updates included) without the dependency.
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.matchMedia
    ) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = (event: MediaQueryListEvent) => {
        setReduceMotion(event.matches);
      };
      query.addEventListener?.("change", onChange);
      return () => query.removeEventListener?.("change", onChange);
    }

    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
