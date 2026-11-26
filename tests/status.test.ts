import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({ getDb: vi.fn() }));
vi.mock("../server/prices", () => ({ getWarmerStatus: vi.fn() }));
vi.mock("../server/image-thumbnail", () => ({ thumbnailStats: vi.fn() }));
vi.mock("../server/product-images", () => ({ imageCacheEntryCount: vi.fn() }));

import { getDb } from "../server/db";
import { getWarmerStatus } from "../server/prices";
import { thumbnailStats } from "../server/image-thumbnail";
import { imageCacheEntryCount } from "../server/product-images";
import { getStatusSnapshot } from "../server/status";

const mockedGetDb = vi.mocked(getDb);
const mockedWarmer = vi.mocked(getWarmerStatus);
const mockedThumbnails = vi.mocked(thumbnailStats);
const mockedImageCache = vi.mocked(imageCacheEntryCount);

const warmer = {
  running: false,
  lastStartedAt: 1_700_000_000_000,
  lastFinishedAt: 1_700_000_001_500,
  lastDurationMs: 1_500,
  lastOk: true,
  failedSteps: 0,
  steps: [{ name: "warmCatalogRotation", durationMs: 900, ok: true }],
};
const thumbnails = {
  active: 1,
  queued: 2,
  maxConcurrent: 4,
  maxQueued: 64,
  cached: 10,
};

describe("getStatusSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWarmer.mockReturnValue(warmer);
    mockedThumbnails.mockReturnValue(thumbnails);
    mockedImageCache.mockReturnValue(5);
  });

  it("reports ok with the warmer and thumbnail stats", async () => {
    mockedGetDb.mockResolvedValue({
      execute: vi.fn(async () => undefined),
    } as never);

    const snapshot = await getStatusSnapshot();

    expect(snapshot.ok).toBe(true);
    expect(snapshot.db).toBe("ok");
    expect(snapshot.warmer).toEqual(warmer);
    expect(snapshot.warmer.steps[0]?.name).toBe("warmCatalogRotation");
    expect(snapshot.thumbnails).toEqual(thumbnails);
    expect(snapshot.imageCacheEntries).toBe(5);
    expect(snapshot.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(snapshot.node).toMatch(/^v\d+/);
    expect(Date.parse(snapshot.startedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("treats a missing database as not configured, not an outage", async () => {
    mockedGetDb.mockResolvedValue(null as never);
    const snapshot = await getStatusSnapshot();
    expect(snapshot.ok).toBe(true);
    expect(snapshot.db).toBe("not_configured");
  });

  it("reports a database error as not ok and does not leak the driver error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetDb.mockResolvedValue({
      execute: vi.fn(async () => {
        throw new Error("mysql://user:secret@db.internal/schema");
      }),
    } as never);

    const snapshot = await getStatusSnapshot();

    expect(snapshot.ok).toBe(false);
    expect(snapshot.db).toBe("error");
    expect(JSON.stringify(snapshot)).not.toContain("secret");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
