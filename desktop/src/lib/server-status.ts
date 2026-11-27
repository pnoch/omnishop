/**
 * Shape and formatting for `/api/status`. The endpoint is public JSON, so the
 * desktop validates it instead of casting: a proxy page or an older server must
 * produce a readable "unexpected payload" state, not a half-rendered card.
 */

export type StatusTone = "ok" | "warn" | "error" | "idle";
export type DbStatus = "ok" | "not_configured" | "error";

export interface WarmerStepStatus {
  name: string;
  durationMs: number;
  ok: boolean;
}

export interface NearExpiryStatus {
  attempted: number;
  refreshed: number;
  failed: number;
  backedOff: number;
}

export interface WarmerStatus {
  running: boolean;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastDurationMs: number | null;
  lastOk: boolean | null;
  failedSteps: number;
  steps: WarmerStepStatus[];
  nearExpiry: NearExpiryStatus | null;
}

export interface ThumbnailStatus {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueued: number;
  cached: number;
}

export interface ServerStatus {
  ok: boolean;
  db: DbStatus;
  startedAt: string | null;
  uptimeSec: number;
  node: string;
  rssMb: number;
  warmer: WarmerStatus;
  thumbnails: ThumbnailStatus;
  imageCacheEntries: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseServerStatus(value: unknown): ServerStatus | null {
  if (!isRecord(value)) return null;
  const db = value.db;
  if (db !== "ok" && db !== "not_configured" && db !== "error") return null;
  if (typeof value.ok !== "boolean") return null;

  const warmer = isRecord(value.warmer) ? value.warmer : null;
  const thumbnails = isRecord(value.thumbnails) ? value.thumbnails : null;
  if (!warmer || !thumbnails) return null;

  return {
    ok: value.ok,
    db,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    uptimeSec: numberOr(value.uptimeSec, 0),
    node: typeof value.node === "string" ? value.node : "",
    rssMb: numberOr(value.rssMb, 0),
    warmer: {
      running: value.warmer !== null && warmer.running === true,
      lastStartedAt: nullableNumber(warmer.lastStartedAt),
      lastFinishedAt: nullableNumber(warmer.lastFinishedAt),
      lastDurationMs: nullableNumber(warmer.lastDurationMs),
      lastOk: nullableBoolean(warmer.lastOk),
      failedSteps: numberOr(warmer.failedSteps, 0),
      steps: Array.isArray(warmer.steps)
        ? warmer.steps
            .flatMap((step) =>
              isRecord(step) && typeof step.name === "string"
                ? [
                    {
                      name: step.name,
                      durationMs: numberOr(step.durationMs, 0),
                      ok: step.ok === true,
                    },
                  ]
                : [],
            )
            .slice(0, 64)
        : [],
      nearExpiry: isRecord(warmer.nearExpiry)
        ? {
            attempted: numberOr(warmer.nearExpiry.attempted, 0),
            refreshed: numberOr(warmer.nearExpiry.refreshed, 0),
            failed: numberOr(warmer.nearExpiry.failed, 0),
            backedOff: numberOr(warmer.nearExpiry.backedOff, 0),
          }
        : null,
    },
    thumbnails: {
      active: numberOr(thumbnails.active, 0),
      queued: numberOr(thumbnails.queued, 0),
      maxConcurrent: numberOr(thumbnails.maxConcurrent, 0),
      maxQueued: numberOr(thumbnails.maxQueued, 0),
      cached: numberOr(thumbnails.cached, 0),
    },
    imageCacheEntries: numberOr(value.imageCacheEntries, 0),
  };
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  if (total < 3_600) return `${Math.floor(total / 60)}m`;
  if (total < 86_400) {
    const hours = Math.floor(total / 3_600);
    const minutes = Math.floor((total % 3_600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1_000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** The step that consumed the most of the last warmer tick, if any. */
export function slowestStep(
  steps: WarmerStepStatus[],
): WarmerStepStatus | null {
  let slowest: WarmerStepStatus | null = null;
  for (const step of steps) {
    if (!slowest || step.durationMs > slowest.durationMs) slowest = step;
  }
  return slowest;
}

/** `warmCatalogRotation` → `warm catalog rotation`. */
export function formatStepName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

export function dbState(db: DbStatus): { label: string; tone: StatusTone } {
  if (db === "ok") return { label: "Connected", tone: "ok" };
  if (db === "not_configured") return { label: "Not configured", tone: "idle" };
  return { label: "Unavailable", tone: "error" };
}

export function warmerState(warmer: WarmerStatus): {
  label: string;
  tone: StatusTone;
  detail: string;
} {
  if (warmer.running) {
    return {
      label: "Running",
      tone: "idle",
      detail: "A warmer tick is in progress",
    };
  }
  if (warmer.lastOk === null) {
    return {
      label: "Waiting",
      tone: "idle",
      detail: "No tick has finished yet",
    };
  }
  if (!warmer.lastOk) {
    return {
      label: "Degraded",
      tone: "warn",
      detail: `${warmer.failedSteps} step${warmer.failedSteps === 1 ? "" : "s"} failed in the last tick`,
    };
  }
  return {
    label: "Healthy",
    tone: "ok",
    detail: `Last tick took ${formatDuration(warmer.lastDurationMs)}`,
  };
}
