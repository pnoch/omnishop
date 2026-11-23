// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

const panConfig = vi.hoisted(() => ({ current: null as any }));
const animations = vi.hoisted(() => ({
  values: [] as any[],
  springs: [] as any[],
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  class AnimatedValue {
    constructor(public v: number) {
      animations.values.push(this);
    }
    setValue(v: number) {
      this.v = v;
    }
    interpolate() {
      return new AnimatedValue(this.v);
    }
    stopAnimation(callback?: (value: number) => void) {
      callback?.(this.v);
    }
  }
  return {
    View: ({ children, style: _style, ...r }: any) =>
      React.createElement("div", r, children),
    Text: ({ children, style: _style, ...r }: any) =>
      React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, style: _style, ...r }: any) =>
      React.createElement(
        "button",
        { ...r, "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
    Platform: { OS: "web" },
    Animated: {
      View: ({ children, style: _style, ...r }: any) =>
        React.createElement("div", r, children),
      Value: AnimatedValue,
      spring: (value: any, config: any) => {
        animations.springs.push({ value, config });
        return { start: () => {} };
      },
    },
    PanResponder: {
      create: (config: any) => {
        panConfig.current = config;
        return { panHandlers: {} };
      },
    },
  };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Warning: "warning" },
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    success: "#00C896",
    error: "#EF4444",
  }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => React.createElement("span"),
}));

import { SwipeableCard } from "@/components/watchlist/swipeable-card";

describe("SwipeableCard", () => {
  afterEach(() => {
    cleanup();
    panConfig.current = null;
    animations.values.length = 0;
    animations.springs.length = 0;
  });

  it("renders the configured actions and removes on press", () => {
    const onDelete = vi.fn();
    const onToggleAlert = vi.fn();
    const onToggleAcquired = vi.fn();
    render(
      <SwipeableCard
        onDelete={onDelete}
        onToggleAlert={onToggleAlert}
        onToggleAcquired={onToggleAcquired}
        hasAlert
      >
        <div>CRS326</div>
      </SwipeableCard>,
    );

    expect(screen.getByText("Muted")).toBeTruthy();
    expect(screen.getByText("Want")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove from watchlist"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Manage price alert"));
    expect(onToggleAlert).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Mark as acquired"));
    expect(onToggleAcquired).toHaveBeenCalledTimes(1);
  });

  it("opens past the halfway point and snaps back under it", () => {
    render(
      <SwipeableCard
        onDelete={() => {}}
        onToggleAlert={() => {}}
        onToggleAcquired={() => {}}
      >
        <div>CRS326</div>
      </SwipeableCard>,
    );
    const handlers = panConfig.current;

    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, { dx: -150, dy: 0 });
    handlers.onPanResponderRelease({}, { dx: -150, dy: 0, vx: 0 });
    expect(animations.springs.at(-1).config.toValue).toBe(-216);

    // From the open offset, a rightward drag past halfway closes it.
    handlers.onPanResponderGrant();
    handlers.onPanResponderMove({}, { dx: 120, dy: 0 });
    handlers.onPanResponderRelease({}, { dx: 120, dy: 0, vx: 0 });
    expect(animations.springs.at(-1).config.toValue).toBe(0);
  });

  it("omits actions that have no handler", () => {
    render(
      <SwipeableCard onDelete={() => {}}>
        <div>CRS326</div>
      </SwipeableCard>,
    );
    expect(screen.queryByText("Alert")).toBeNull();
    expect(screen.queryByText("Want")).toBeNull();
    expect(screen.getByText("Remove")).toBeTruthy();
  });
});
