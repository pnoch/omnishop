import { describe, expect, it } from "vitest";
import { shouldShowNotificationPermissionBanner } from "../lib/notification-permission-banner";

const base = {
  platform: "ios",
  status: "denied",
  alertCount: 1,
  reminderCount: 0,
  watchCount: 0,
};

describe("shouldShowNotificationPermissionBanner", () => {
  it("shows when permission is denied and something is saved", () => {
    expect(shouldShowNotificationPermissionBanner(base)).toBe(true);
  });

  it("does not show on web", () => {
    expect(
      shouldShowNotificationPermissionBanner({ ...base, platform: "web" }),
    ).toBe(false);
  });

  it("does not show when permission is granted or undetermined", () => {
    expect(
      shouldShowNotificationPermissionBanner({ ...base, status: "granted" }),
    ).toBe(false);
    expect(
      shouldShowNotificationPermissionBanner({ ...base, status: "undetermined" }),
    ).toBe(false);
    expect(
      shouldShowNotificationPermissionBanner({ ...base, status: null }),
    ).toBe(false);
  });

  it("does not show when nothing is saved to notify about", () => {
    expect(
      shouldShowNotificationPermissionBanner({
        ...base,
        alertCount: 0,
        reminderCount: 0,
        watchCount: 0,
      }),
    ).toBe(false);
  });

  it("counts reminders and stock watches too", () => {
    expect(
      shouldShowNotificationPermissionBanner({
        ...base,
        alertCount: 0,
        reminderCount: 1,
        watchCount: 1,
      }),
    ).toBe(true);
  });
});
