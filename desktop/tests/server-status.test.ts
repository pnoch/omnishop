import { describe, expect, it } from "vitest";
import {
  dbState,
  formatDuration,
  formatStepName,
  formatUptime,
  parseServerStatus,
  slowestStep,
  warmerState,
} from "../src/lib/server-status";

const payload = {
  ok: true,
  db: "ok",
  startedAt: "2026-11-25T00:00:00.000Z",
  uptimeSec: 3600,
  node: "v22.13.0",
  rssMb: 120,
  warmer: {
    running: false,
    lastStartedAt: 1,
    lastFinishedAt: 2,
    lastDurationMs: 1500,
    lastOk: true,
    failedSteps: 0,
    steps: [
      { name: "warmCatalogRotation", durationMs: 900, ok: true },
      { name: "purgeOldHistory", durationMs: 120, ok: true },
    ],
  },
  thumbnails: {
    active: 1,
    queued: 2,
    maxConcurrent: 4,
    maxQueued: 64,
    cached: 9,
  },
  imageCacheEntries: 3,
};

describe("parseServerStatus", () => {
  it("accepts the endpoint payload", () => {
    const status = parseServerStatus(payload);
    expect(status?.db).toBe("ok");
    expect(status?.warmer.lastDurationMs).toBe(1500);
    expect(status?.warmer.steps).toHaveLength(2);
    expect(status?.thumbnails.maxQueued).toBe(64);
    expect(status?.imageCacheEntries).toBe(3);
  });

  it("rejects a non-object or unknown database state", () => {
    expect(parseServerStatus(null)).toBeNull();
    expect(parseServerStatus([])).toBeNull();
    expect(parseServerStatus({ ...payload, db: "sleeping" })).toBeNull();
    expect(parseServerStatus({ ...payload, ok: "yes" })).toBeNull();
  });

  it("rejects a payload without the nested status blocks", () => {
    expect(parseServerStatus({ ...payload, warmer: undefined })).toBeNull();
    expect(parseServerStatus({ ...payload, thumbnails: null })).toBeNull();
  });

  it("normalizes missing optional numbers instead of rendering NaN", () => {
    const status = parseServerStatus({
      ...payload,
      uptimeSec: "soon",
      warmer: { running: false },
      thumbnails: {},
      imageCacheEntries: null,
    });
    expect(status?.uptimeSec).toBe(0);
    expect(status?.warmer.lastDurationMs).toBeNull();
    expect(status?.thumbnails.active).toBe(0);
    expect(status?.imageCacheEntries).toBe(0);
    expect(status?.warmer.steps).toEqual([]);
  });

  it("drops malformed step entries instead of rendering them", () => {
    const status = parseServerStatus({
      ...payload,
      warmer: {
        ...payload.warmer,
        steps: [
          { name: "warmCatalogRotation", durationMs: 10, ok: true },
          { durationMs: 20 },
          "nope",
          { name: "other", durationMs: "soon", ok: false },
        ],
      },
    });
    expect(status?.warmer.steps).toEqual([
      { name: "warmCatalogRotation", durationMs: 10, ok: true },
      { name: "other", durationMs: 0, ok: false },
    ]);
  });
});

describe("formatUptime", () => {
  it("formats seconds, minutes, hours, and days", () => {
    expect(formatUptime(0)).toBe("0s");
    expect(formatUptime(59)).toBe("59s");
    expect(formatUptime(60)).toBe("1m");
    expect(formatUptime(3_599)).toBe("59m");
    expect(formatUptime(3_600)).toBe("1h");
    expect(formatUptime(3_660)).toBe("1h 1m");
    expect(formatUptime(86_400)).toBe("1d");
    expect(formatUptime(90_000)).toBe("1d 1h");
    expect(formatUptime(Number.NaN)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds up to hours", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(500)).toBe("500 ms");
    expect(formatDuration(1_500)).toBe("1.5 s");
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(65_000)).toBe("1m 5s");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });
});

describe("state labels", () => {
  it("maps database states to labels and tones", () => {
    expect(dbState("ok")).toEqual({ label: "Connected", tone: "ok" });
    expect(dbState("not_configured")).toEqual({
      label: "Not configured",
      tone: "idle",
    });
    expect(dbState("error")).toEqual({ label: "Unavailable", tone: "error" });
  });

  it("describes every warmer phase", () => {
    expect(
      warmerState({ ...payload.warmer, running: true }).label,
    ).toBe("Running");
    expect(
      warmerState({ ...payload.warmer, lastOk: null }).label,
    ).toBe("Waiting");
    expect(
      warmerState({ ...payload.warmer, lastOk: false, failedSteps: 1 }),
    ).toEqual({
      label: "Degraded",
      tone: "warn",
      detail: "1 step failed in the last tick",
    });
    expect(
      warmerState({ ...payload.warmer, lastOk: false, failedSteps: 3 }).detail,
    ).toBe("3 steps failed in the last tick");
    expect(warmerState(payload.warmer)).toEqual({
      label: "Healthy",
      tone: "ok",
      detail: "Last tick took 1.5 s",
    });
  });
});

describe("warmer step helpers", () => {
  it("picks the longest step and handles an empty list", () => {
    expect(slowestStep([])).toBeNull();
    expect(slowestStep(payload.warmer.steps)?.name).toBe(
      "warmCatalogRotation",
    );
  });

  it("humanizes camelCase and snake_case step names", () => {
    expect(formatStepName("warmCatalogRotation")).toBe(
      "warm catalog rotation",
    );
    expect(formatStepName("purge_old_history")).toBe("purge old history");
  });
});
