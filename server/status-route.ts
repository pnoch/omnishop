import type { Express, Request, Response } from "express";
import { getClientIp, tryCheckRateLimitByKey } from "./rate-limit";
import type { StatusSnapshot } from "./status";

/**
 * `GET /api/status` — the operator-facing counterpart to `/api/healthz`.
 *
 * Health answers "should the proxy send traffic?"; status answers "is the
 * background machinery healthy?" (warmer last tick, thumbnail encoder queue,
 * memory). It is cached for a few seconds because every call checks the
 * database, and rate limited because it is public.
 */

export interface StatusRouteDeps {
  getSnapshot: () => Promise<StatusSnapshot>;
  allow: (key: string, limit: number, windowMs: number) => boolean;
}

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export function createStatusHandler(
  deps: StatusRouteDeps,
  cacheMs = 5_000,
): (req: Request, res: Response) => Promise<void> {
  let cached: { at: number; snapshot: StatusSnapshot } | null = null;

  return async (req, res) => {
    if (!deps.allow(`status:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      res.set("Retry-After", "60");
      res.set("Cache-Control", "no-store");
      res.status(429).json({ ok: false, error: "rate_limited" });
      return;
    }

    const now = Date.now();
    if (!cached || cacheMs <= 0 || now - cached.at >= cacheMs) {
      try {
        cached = { at: now, snapshot: await deps.getSnapshot() };
      } catch (e) {
        console.error("[status] snapshot failed:", e);
        res.set("Cache-Control", "no-store");
        res.status(503).json({ ok: false, error: "snapshot_failed" });
        return;
      }
    }

    res.set("Cache-Control", "no-store");
    res.status(cached.snapshot.ok ? 200 : 503).json(cached.snapshot);
  };
}

export function registerStatusRoute(
  app: Express,
  getSnapshot: () => Promise<StatusSnapshot>,
): void {
  app.get(
    "/api/status",
    createStatusHandler({ getSnapshot, allow: tryCheckRateLimitByKey }),
  );
}
