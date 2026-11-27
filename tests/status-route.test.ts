import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createStatusHandler } from "../server/status-route";
import type { StatusSnapshot } from "../server/status";

let server: Server | null = null;

function snapshot(overrides: Partial<StatusSnapshot> = {}): StatusSnapshot {
  return {
    ok: true,
    db: "ok",
    startedAt: "2026-11-25T00:00:00.000Z",
    uptimeSec: 120,
    node: "v22.13.0",
    rssMb: 80,
    warmer: {
      running: false,
      lastStartedAt: 1,
      lastFinishedAt: 2,
      lastDurationMs: 1,
      lastOk: true,
      failedSteps: 0,
      steps: [{ name: "warmCatalogRotation", durationMs: 900, ok: true }],
      nearExpiry: { attempted: 10, refreshed: 7, failed: 3, backedOff: 1 },
    },
    thumbnails: {
      active: 0,
      queued: 0,
      maxConcurrent: 4,
      maxQueued: 64,
      cached: 3,
    },
    imageCacheEntries: 2,
    ...overrides,
  };
}

async function withServer(
  handler: ReturnType<typeof createStatusHandler>,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.get("/api/status", handler);
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("no port");
  await run(`http://127.0.0.1:${address.port}`);
}

afterEach(() => {
  server?.close();
  server = null;
});

describe("status route", () => {
  it("serves the snapshot as no-store JSON", async () => {
    const getSnapshot = vi.fn(async () => snapshot());
    await withServer(
      createStatusHandler({ getSnapshot, allow: () => true }, 0),
      async (base) => {
        const res = await fetch(`${base}/api/status`);
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("no-store");
        const body = await res.json();
        expect(body.db).toBe("ok");
        expect(body.thumbnails.maxQueued).toBe(64);
        expect(getSnapshot).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("answers 503 when the database check failed", async () => {
    await withServer(
      createStatusHandler(
        { getSnapshot: async () => snapshot({ ok: false, db: "error" }), allow: () => true },
        0,
      ),
      async (base) => {
        const res = await fetch(`${base}/api/status`);
        expect(res.status).toBe(503);
        expect((await res.json()).db).toBe("error");
      },
    );
  });

  it("caches the snapshot briefly so polling does not hit the database", async () => {
    const getSnapshot = vi.fn(async () => snapshot());
    await withServer(
      createStatusHandler({ getSnapshot, allow: () => true }, 5_000),
      async (base) => {
        await fetch(`${base}/api/status`);
        await fetch(`${base}/api/status`);
        expect(getSnapshot).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("rate limits with Retry-After", async () => {
    await withServer(
      createStatusHandler({ getSnapshot: async () => snapshot(), allow: () => false }, 0),
      async (base) => {
        const res = await fetch(`${base}/api/status`);
        expect(res.status).toBe(429);
        expect(res.headers.get("retry-after")).toBe("60");
        expect(res.headers.get("cache-control")).toBe("no-store");
      },
    );
  });

  it("does not leak a snapshot failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await withServer(
      createStatusHandler(
        {
          getSnapshot: async () => {
            throw new Error("mysql://user:secret@db.internal/schema");
          },
          allow: () => true,
        },
        0,
      ),
      async (base) => {
        const res = await fetch(`${base}/api/status`);
        expect(res.status).toBe(503);
        const body = await res.text();
        expect(body).toContain("snapshot_failed");
        expect(body).not.toContain("secret");
      },
    );
    log.mockRestore();
  });
});
