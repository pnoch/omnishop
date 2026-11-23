// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Modal: ({ visible, children }: any) =>
      visible ? React.createElement("div", { "data-modal": "true" }, children) : null,
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, style }: any) =>
      React.createElement(
        "button",
        {
          "aria-label": accessibilityLabel,
          onClick: onPress,
          "data-pressed": typeof style === "function" ? "fn" : undefined,
        },
        children,
      ),
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    foreground: "#111",
    muted: "#888",
    primary: "#0F52BA",
    background: "#fff",
    surface: "#fff",
    border: "#ddd",
  }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: ({ name }: { name: string }) => React.createElement("i", { "data-icon": name }),
}));

import { readFileSync } from "node:fs";
import { SnoozeAlertSheet } from "@/components/alerts/snooze-alert-sheet";

const alert = {
  id: "a1",
  productId: "p1",
  targetPrice: 100,
  currency: "USD",
  direction: "drop" as const,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  snoozedUntil: undefined as string | undefined,
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof SnoozeAlertSheet>> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <SnoozeAlertSheet
      visible
      alert={alert as never}
      productName="CRS326"
      onSelect={onSelect}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSelect, onClose };
}

describe("SnoozeAlertSheet", () => {
  afterEach(cleanup);

  it("offers preset durations and no wake action while active", () => {
    const { onSelect } = renderSheet();
    expect(screen.getByText("CRS326")).toBeTruthy();
    for (const days of [1, 3, 7, 30]) {
      expect(screen.getByText(`${days} day${days === 1 ? "" : "s"}`)).toBeTruthy();
    }
    expect(screen.queryByText("Wake now")).toBeNull();
    fireEvent.click(screen.getByLabelText(/^7 days/));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("shows the current snooze and a wake action when snoozed", () => {
    renderSheet({
      alert: {
        ...alert,
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      } as never,
    });
    expect(screen.getByText(/snoozed until/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Wake now/)).toBeTruthy();
  });

  it("replaces the web day-count prompt", () => {
    const src = readFileSync("hooks/use-alerts-data.ts", "utf8");
    expect(src).not.toContain("window.prompt(");
    expect(src).toContain("setSnoozeTarget");
  });

  it("wakes immediately and closes", () => {
    const { onSelect, onClose } = renderSheet({
      alert: {
        ...alert,
        snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      } as never,
    });
    fireEvent.click(screen.getByLabelText(/^Wake now/));
    expect(onSelect).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByLabelText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
