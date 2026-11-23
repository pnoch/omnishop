import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// RN `Animated` components cannot import Reanimated's reduced-motion hook
// without pulling the worklets runtime into every test that renders them.
// AccessibilityInfo is the native source of truth; the web has no reliable
// AccessibilityInfo motion query, so it reads prefers-reduced-motion.
export function useReduceMotion(): boolean {
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
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        if (active) setReduceMotion(enabled);
      },
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
