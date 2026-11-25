import { getDb } from "./db";
import { thumbnailStats } from "./image-thumbnail";
import { imageCacheEntryCount } from "./product-images";
import { getWarmerStatus, type WarmerStatus } from "./prices";

/**
 * Ops snapshot for `/api/status`. Deliberately aggregate-only: database
 * reachability, process age/memory, the warmer's last tick, and the thumbnail
 * encoder queue. No hosts, user data, or step error text.
 */

const STARTED_AT = Date.now() - Math.round(process.uptime() * 1000);

export type DbStatus = "ok" | "not_configured" | "error";

export interface StatusSnapshot {
  ok: boolean;
  db: DbStatus;
  startedAt: string;
  uptimeSec: number;
  node: string;
  rssMb: number;
  warmer: WarmerStatus;
  thumbnails: ReturnType<typeof thumbnailStats>;
  imageCacheEntries: number;
}

export async function checkDatabaseStatus(): Promise<DbStatus> {
  try {
    const db = await getDb();
    if (!db) return "not_configured";
    await db.execute("SELECT 1" as never);
    return "ok";
  } catch (e) {
    // Log the detail server-side; the payload only carries the state.
    console.error("[status] db check failed:", e);
    return "error";
  }
}

export async function getStatusSnapshot(): Promise<StatusSnapshot> {
  const db = await checkDatabaseStatus();
  return {
    ok: db !== "error",
    db,
    startedAt: new Date(STARTED_AT).toISOString(),
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    warmer: getWarmerStatus(),
    thumbnails: thumbnailStats(),
    imageCacheEntries: imageCacheEntryCount(),
  };
}
