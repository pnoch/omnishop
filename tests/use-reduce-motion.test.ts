// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(false),
    addEventListener: () => ({ remove: () => {} }),
  },
}));

import { useReduceMotion } from "../hooks/use-reduce-motion";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  window.matchMedia = vi.fn(() => ({
    matches,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  })) as unknown as typeof window.matchMedia;
  return {
    emit(next: boolean) {
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
  };
}

describe("useReduceMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the web media query and follows changes", () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
    act(() => media.emit(false));
    expect(result.current).toBe(false);
  });

  it("starts false when the preference is not set", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
  });
});
