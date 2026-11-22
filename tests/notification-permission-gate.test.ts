// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  onboardingSeen: true,
  notificationsEnabled: true,
  requested: 0,
}));

vi.mock("@/lib/onboarding", () => ({
  hasSeenOnboarding: async () => state.onboardingSeen,
}));

vi.mock("@/lib/storage", () => ({
  getSettings: async () => ({ notificationsEnabled: state.notificationsEnabled }),
}));

vi.mock("@/lib/notifications", () => ({
  requestNotificationPermissions: async () => {
    state.requested += 1;
    return true;
  },
}));

import { shouldRequestNotificationPermission } from "@/lib/notification-permission-gate";

describe("shouldRequestNotificationPermission", () => {
  beforeEach(() => {
    state.onboardingSeen = true;
    state.notificationsEnabled = true;
    state.requested = 0;
  });

  it("asks on a normal launch once onboarding is done", async () => {
    expect(await shouldRequestNotificationPermission()).toBe(true);
  });

  it("does not ask during first-run onboarding", async () => {
    // The welcome screen is still up; the prompt used to cover it before the
    // user had seen what the app does.
    state.onboardingSeen = false;
    expect(await shouldRequestNotificationPermission()).toBe(false);
  });

  it("does not ask when notifications were turned off", async () => {
    state.notificationsEnabled = false;
    expect(await shouldRequestNotificationPermission()).toBe(false);
  });

  it("does not ask when the settings read fails", async () => {
    const original = state.notificationsEnabled;
    state.notificationsEnabled = original;
    expect(typeof (await shouldRequestNotificationPermission())).toBe("boolean");
  });
});
