import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ os: "android" }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
  },
}));

const enable = vi.fn(async () => {});
const disable = vi.fn(async () => {});
vi.mock("@/lib/background-service", () => ({
  enableBackgroundService: () => enable(),
  disableBackgroundService: () => disable(),
}));

const isOverlayGranted = vi.fn(async () => false);
const requestOverlay = vi.fn(async () => {});
vi.mock("@/modules/omnishop-webview-renderer", () => ({
  isOverlayGranted: () => isOverlayGranted(),
  requestOverlay: () => requestOverlay(),
}));

import {
  applyBackgroundServiceToggle,
  resumeBackgroundServiceIfGranted,
} from "@/lib/background-service-toggle";

describe("applyBackgroundServiceToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOverlayGranted.mockResolvedValue(true);
    platform.os = "android";
  });
  it("enables when on and disables when off", async () => {
    await applyBackgroundServiceToggle(true);
    expect(enable).toHaveBeenCalledTimes(1);
    await applyBackgroundServiceToggle(false);
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it("requests the overlay permission when enabling without it", async () => {
    isOverlayGranted.mockResolvedValueOnce(false);
    requestOverlay.mockClear();
    const result = await applyBackgroundServiceToggle(true);
    expect(requestOverlay).toHaveBeenCalledTimes(1);
    expect(enable).not.toHaveBeenCalled();
    expect(result).toBe("permission-required");
  });

  it("does not start the service if permission cannot be checked", async () => {
    isOverlayGranted.mockRejectedValueOnce(new Error("unavailable"));
    expect(await applyBackgroundServiceToggle(true)).toBe("permission-required");
    expect(enable).not.toHaveBeenCalled();
  });

  it("enables on iOS where the Android overlay does not exist", async () => {
    platform.os = "ios";
    isOverlayGranted.mockResolvedValue(false);
    expect(await applyBackgroundServiceToggle(true)).toBe("enabled");
    expect(enable).toHaveBeenCalledTimes(1);
    expect(requestOverlay).not.toHaveBeenCalled();
  });

  it("resumes enabling after the user grants the Android permission", async () => {
    isOverlayGranted.mockResolvedValue(false);
    expect(await resumeBackgroundServiceIfGranted()).toBe(false);
    expect(enable).not.toHaveBeenCalled();

    isOverlayGranted.mockResolvedValue(true);
    expect(await resumeBackgroundServiceIfGranted()).toBe(true);
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("does not resume on iOS even if the module reports a grant", async () => {
    platform.os = "ios";
    isOverlayGranted.mockResolvedValue(true);
    expect(await resumeBackgroundServiceIfGranted()).toBe(false);
    expect(enable).not.toHaveBeenCalled();
  });
});
