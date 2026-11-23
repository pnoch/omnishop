// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showAlert } from "../lib/alert";

const { alertMock } = vi.hoisted(() => ({ alertMock: vi.fn() }));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: alertMock },
}));

import {
  dismissWebAlert,
  getWebAlertSnapshot,
  resetWebAlertsForTests,
  resolveWebAlert,
} from "../lib/web-alert-store";

describe("showAlert on web", () => {
  beforeEach(() => {
    resetWebAlertsForTests();
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    window.prompt = vi.fn(() => "1");
  });

  it("queues a themed dialog instead of prompting", () => {
    const onPress = vi.fn();
    showAlert("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
    const current = getWebAlertSnapshot().current;
    expect(current?.title).toBe("Remove");
    expect(current?.message).toBe("Remove this?");
    expect(current?.buttons.map((button) => button.text)).toEqual([
      "Cancel",
      "Remove",
    ]);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.prompt).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();

    resolveWebAlert(current!.buttons[1]);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getWebAlertSnapshot().current).toBeNull();
  });

  it("runs the cancel action when dismissed", () => {
    const cancel = vi.fn();
    showAlert("Choose", "What next?", [
      { text: "Share" },
      { text: "Cancel", style: "cancel", onPress: cancel },
    ]);
    dismissWebAlert();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getWebAlertSnapshot().current).toBeNull();
  });

  it("queues alerts one at a time and advances after each", () => {
    showAlert("First", "One", [{ text: "OK" }]);
    showAlert("Second", "Two", [{ text: "OK" }]);
    let state = getWebAlertSnapshot();
    expect(state.current?.title).toBe("First");
    expect(state.pending).toBe(1);

    resolveWebAlert(state.current!.buttons[0]);
    state = getWebAlertSnapshot();
    expect(state.current?.title).toBe("Second");
    expect(state.pending).toBe(0);
  });

  it("defaults to an OK button when none are given", () => {
    showAlert("Oops", "Something went wrong.");
    expect(
      getWebAlertSnapshot().current?.buttons.map((button) => button.text),
    ).toEqual(["OK"]);
  });

  it("does nothing when the DOM window is unavailable", () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() =>
        showAlert("Choose", "What next?", [{ text: "A" }, { text: "B" }]),
      ).not.toThrow();
      expect(getWebAlertSnapshot().current).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: original,
        configurable: true,
      });
    }
  });
});

describe("showAlert on native", () => {
  beforeEach(() => {
    alertMock.mockClear();
  });

  it("delegates to Alert.alert", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "ios";
    const onPress = vi.fn();
    showAlert("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
    expect(alertMock).toHaveBeenCalledWith("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
  });

  // Android shows at most 3 buttons and silently drops extras. When a "More…"
  // button is needed it must consume a slot, or the 4th button is dropped and
  // the remaining actions become unreachable.
  it("never passes more than 3 buttons on Android", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "android";
    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      { text: "C" },
      { text: "D" },
    ]);
    const buttons = alertMock.mock.calls.at(-1)![2] as unknown[];
    expect(buttons.length).toBeLessThanOrEqual(3);
    expect((buttons.at(-1) as { text: string }).text).toBe("More…");

    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      { text: "C" },
      { text: "D" },
      { text: "Cancel", style: "cancel" },
    ]);
    const withCancel = alertMock.mock.calls.at(-1)![2] as unknown[];
    expect(withCancel.length).toBeLessThanOrEqual(3);
    expect((withCancel.at(-1) as { text: string }).text).toBe("More…");
  });

  it("appends the cancel button when no actions are hidden", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "android";
    const cancel = { text: "Cancel", style: "cancel" as const };
    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      cancel,
    ]);
    const buttons = alertMock.mock.calls.at(-1)![2] as { text: string }[];
    expect(buttons.map((b) => b.text)).toEqual(["A", "B", "Cancel"]);
  });

  it("passes three actions through when there is no cancel", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "android";
    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      { text: "C" },
    ]);
    const buttons = alertMock.mock.calls.at(-1)![2] as { text: string }[];
    expect(buttons.map((b) => b.text)).toEqual(["A", "B", "C"]);
  });
});
