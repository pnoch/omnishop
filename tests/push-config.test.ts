import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  expoConfig: null as { extra?: Record<string, unknown> } | null,
  easConfig: null as { projectId?: string } | null,
}));

vi.mock("expo-constants", () => ({
  default: {
    get expoConfig() {
      return state.expoConfig;
    },
    get easConfig() {
      return state.easConfig;
    },
  },
}));

import { getPushConfiguration } from "@/lib/push-config";

describe("getPushConfiguration", () => {
  beforeEach(() => {
    state.expoConfig = null;
    state.easConfig = null;
  });

  it("uses the configured Expo project id", () => {
    state.expoConfig = { extra: { expoProjectId: "proj-1" } };
    expect(getPushConfiguration()).toEqual({
      kind: "configured",
      projectId: "proj-1",
    });
  });

  it("falls back to the EAS-linked project id", () => {
    state.easConfig = { projectId: "eas-1" };
    expect(getPushConfiguration()).toEqual({
      kind: "configured",
      projectId: "eas-1",
    });
  });

  it("treats a blank value as missing instead of passing it to Expo", () => {
    state.expoConfig = { extra: { expoProjectId: "   " } };
    expect(getPushConfiguration()).toEqual({ kind: "missing-project-id" });
  });

  it("falls through a blank override to the EAS id", () => {
    state.expoConfig = { extra: { expoProjectId: "" } };
    state.easConfig = { projectId: "eas-2" };
    expect(getPushConfiguration()).toEqual({
      kind: "configured",
      projectId: "eas-2",
    });
  });

  it("reports a build without any project id", () => {
    expect(getPushConfiguration()).toEqual({ kind: "missing-project-id" });
  });
});
