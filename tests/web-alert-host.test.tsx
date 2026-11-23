// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { forwardRef } from "react";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Modal: ({ visible, children }: any) =>
    visible ? React.createElement("div", { "data-modal": "true" }, children) : null,
  View: ({ children, ...r }: any) => React.createElement("div", r, children),
  Text: ({ children, accessibilityRole, ...r }: any) =>
    React.createElement("span", { role: accessibilityRole, ...r }, children),
  Pressable: forwardRef(function Pressable(
    { children, onPress, accessibilityLabel, accessibilityRole, style }: any,
    ref,
  ) {
    return React.createElement(
      "button",
      {
        ref,
        "aria-label": accessibilityLabel,
        role: accessibilityRole,
        onClick: onPress,
      },
      children,
    );
  }),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    foreground: "#111",
    muted: "#888",
    surface: "#fff",
    border: "#ddd",
    error: "#f00",
  }),
}));

import { WebAlertHost } from "@/components/ui/web-alert-host";
import {
  enqueueWebAlert,
  getWebAlertSnapshot,
  resetWebAlertsForTests,
} from "@/lib/web-alert-store";

describe("WebAlertHost", () => {
  afterEach(() => {
    cleanup();
    resetWebAlertsForTests();
  });

  it("renders the queued dialog and runs the chosen action", () => {
    render(<WebAlertHost />);
    const remove = vi.fn();
    const cancel = vi.fn();
    act(() => {
      enqueueWebAlert("Remove Product", "Remove this?", [
        { text: "Cancel", style: "cancel", onPress: cancel },
        { text: "Remove", style: "destructive", onPress: remove },
      ]);
    });

    expect(screen.getByText("Remove Product")).toBeTruthy();
    expect(screen.getByText("Remove this?")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove"));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(getWebAlertSnapshot().current).toBeNull();
  });

  it("dismisses with the cancel action on backdrop press", () => {
    render(<WebAlertHost />);
    const cancel = vi.fn();
    act(() => {
      enqueueWebAlert("Choose", undefined, [
        { text: "Share" },
        { text: "Cancel", style: "cancel", onPress: cancel },
      ]);
    });
    fireEvent.click(screen.getByLabelText("Dismiss dialog"));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("dismisses with Escape", () => {
    render(<WebAlertHost />);
    const cancel = vi.fn();
    act(() => {
      enqueueWebAlert("Choose", undefined, [
        { text: "Cancel", style: "cancel", onPress: cancel },
      ]);
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("shows the next queued dialog after one resolves", () => {
    render(<WebAlertHost />);
    act(() => {
      enqueueWebAlert("First", "One", [{ text: "OK" }]);
      enqueueWebAlert("Second", "Two", [{ text: "OK" }]);
    });
    expect(screen.getByText("First")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("OK"));
    expect(screen.getByText("Second")).toBeTruthy();
  });
});
