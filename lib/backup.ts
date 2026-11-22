import type {
  AppSettings,
  BackOrderReminder,
  DistributorListing,
  PriceAlert,
  Product,
} from "./types";
import { stripBackupSecrets } from "./settings-privacy";

export const BACKUP_FORMAT = "omnishop-backup";
export const LEGACY_BACKUP_FORMATS = ["product-stock-finder-backup"];
export const BACKUP_VERSION = 1;
// A backup is user-controlled input. Cap the file before parsing and each
// collection before merging so a huge or crafted file cannot freeze the app.
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_ITEMS = 5000;

// Baseline used to tell "explicitly customized on the exporting device" apart
// from "merely carried along at its default value": default-valued fields in a
// backup never clobber local customizations during import. Must list every
// AppSettings field that has a default (see lib/storage/settings.ts
// DEFAULT_SETTINGS) — a field missing here is always taken from the backup,
// silently overwriting the local value with the exporter's default.
const SETTING_DEFAULTS: Record<string, unknown> = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "daily",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
  emailAlerts: false,
  webhookAlerts: false,
  alertWebhookUrl: "",
  shippingRegion: "Asia-Pacific",
  webNotificationsEnabled: false,
  backgroundServiceEnabled: false,
  watchlistSort: "recent",
  watchlistGroup: "off",
  taxExempt: false,
  includeImportEstimate: false,
};

export interface BackupInput {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
}

export interface BackupData {
  format: string;
  version: number;
  exportedAt: string;
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings?: AppSettings;
}

export function buildBackup(input: BackupInput): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      watchlist: input.watchlist,
      alerts: input.alerts,
      reminders: input.reminders,
      stockWatches: input.stockWatches,
      // The BYO-LLM API key and webhook URL are secrets: a backup file is
      // user-shareable and stored in plaintext, so they must not be written into it.
      settings: stripBackupSecrets(input.settings),
    },
    null,
    2,
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasId(value: Record<string, unknown>): boolean {
  return typeof value.id === "string" && value.id.length > 0;
}

function asProductArray(value: unknown): Product[] {
  return asArray(value)
    .filter(isRecord)
    .filter((item) => hasId(item) && typeof item.name === "string")
    .map((item) => ({
      ...item,
      listings: Array.isArray(item.listings) ? item.listings : [],
    })) as unknown as Product[];
}

function asAlertArray(value: unknown): PriceAlert[] {
  return asArray(value)
    .filter(isRecord)
    .filter(
      (item) =>
        hasId(item) &&
        typeof item.productId === "string" &&
        item.productId.length > 0 &&
        typeof item.targetPrice === "number" &&
        Number.isFinite(item.targetPrice),
    ) as unknown as PriceAlert[];
}

function asReminderArray(value: unknown): BackOrderReminder[] {
  return asArray(value)
    .filter(isRecord)
    .filter(
      (item) =>
        hasId(item) &&
        typeof item.productId === "string" &&
        item.productId.length > 0 &&
        typeof item.reminderDate === "string" &&
        item.reminderDate.length > 0,
    ) as unknown as BackOrderReminder[];
}

export function parseBackup(json: string): BackupData | null {
  if (json.length > MAX_BACKUP_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (
    obj.format !== BACKUP_FORMAT &&
    !LEGACY_BACKUP_FORMATS.includes(obj.format as string)
  ) {
    return null;
  }
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    return null;
  }
  for (const key of ["watchlist", "alerts", "reminders", "stockWatches"]) {
    if (asArray(obj[key]).length > MAX_BACKUP_ITEMS) return null;
  }
  return {
    format: BACKUP_FORMAT,
    version: obj.version,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    watchlist: asProductArray(obj.watchlist),
    alerts: asAlertArray(obj.alerts),
    reminders: asReminderArray(obj.reminders),
    stockWatches: asReminderArray(obj.stockWatches),
    settings:
      isRecord(obj.settings)
        ? stripBackupSecrets(obj.settings as unknown as AppSettings)
        : undefined,
  };
}

export interface MergeCounts {
  watchlistAdded: number;
  watchlistUpdated: number;
  alertsAdded: number;
  alertsUpdated: number;
  remindersAdded: number;
  remindersUpdated: number;
  stockWatchesAdded: number;
  stockWatchesUpdated: number;
}

export interface ApplyResult {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
  settingsApplied: boolean;
  counts: MergeCounts;
  touchedIds: {
    watchlist: string[];
    alerts: string[];
    reminders: string[];
    stockWatches: string[];
  };
}

interface MergeOutcome<T> {
  merged: T[];
  added: number;
  updated: number;
  touched: string[];
}

// Union keyed on id; incoming (backup) copy wins conflicts; device-only items stay.
function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): MergeOutcome<T> {
  const map = new Map<string, T>();
  for (const item of current) map.set(item.id, item);
  let added = 0;
  let updated = 0;
  const touched: string[] = [];
  for (const item of incoming) {
    if (map.has(item.id)) updated += 1;
    else added += 1;
    map.set(item.id, item);
    touched.push(item.id);
  }
  return { merged: [...map.values()], added, updated, touched };
}

// The watchlist is merged per listing (like the sync engine) rather than
// wholesale: a backup file can be days old, and replacing a product with it
// erased the prices/status/history the device had recorded since — then stamped
// the regression dirty and pushed it to every other device.
function mergeProductListings(local: Product, incoming: Product): Product {
  const byId = new Map<string, DistributorListing>();
  for (const listing of incoming.listings ?? []) {
    byId.set(listing.distributorId, listing);
  }
  for (const listing of local.listings ?? []) {
    const fromBackup = byId.get(listing.distributorId);
    // Keep whichever check is newer; a listing only the device has is kept too.
    // Compare parsed times, not strings: `"…:00Z" >= "…:00.500Z"` lexically but
    // is chronologically earlier, so a mixed-format backup kept the older
    // listing. Mirrors the Rust `listing_last_checked_ms`.
    if (
      !fromBackup ||
      Date.parse(listing.lastChecked ?? "") >=
        Date.parse(fromBackup.lastChecked ?? "")
    ) {
      byId.set(listing.distributorId, listing);
    }
  }
  return { ...incoming, listings: [...byId.values()] };
}

function mergeWatchlist(
  current: Product[],
  incoming: Product[],
): MergeOutcome<Product> {
  const map = new Map<string, Product>(current.map((p) => [p.id, p]));
  let added = 0;
  let updated = 0;
  const touched: string[] = [];
  for (const item of incoming) {
    const local = map.get(item.id);
    if (local) {
      updated += 1;
      map.set(item.id, mergeProductListings(local, item));
    } else {
      added += 1;
      map.set(item.id, item);
    }
    touched.push(item.id);
  }
  return { merged: [...map.values()], added, updated, touched };
}

function mergeSettings(current: AppSettings, incoming: AppSettings): AppSettings {
  const merged = { ...current } as Record<string, unknown>;
  const incomingRecord = incoming as unknown as Record<string, unknown>;
  for (const key of Object.keys(incomingRecord)) {
    if (key === "tagDefinitions") continue;
    // Device-local: never adopt a key from a (possibly shared) backup file.
    if (key === "llmApiKey") continue;
    // Bearer credential: never adopt a URL from a (possibly shared) backup file.
    if (key === "alertWebhookUrl") continue;
    if (
      key in SETTING_DEFAULTS &&
      SETTING_DEFAULTS[key] === incomingRecord[key]
    ) {
      continue;
    }
    // Drop unknown keys and type mismatches: a hand-edited backup must not
    // inject e.g. `displayCurrency: 123` or `checkInterval: {}`.
    if (!(key in current)) continue;
    const currentValue = merged[key];
    const incomingValue = incomingRecord[key];
    if (currentValue !== undefined) {
      if (typeof incomingValue !== typeof currentValue) continue;
      if (Array.isArray(currentValue) !== Array.isArray(incomingValue)) continue;
    }
    merged[key] = incomingValue;
  }
  if (incoming.tagDefinitions) {
    merged.tagDefinitions = {
      ...(current.tagDefinitions ?? {}),
      ...incoming.tagDefinitions,
    };
  }
  return merged as unknown as AppSettings;
}

export function applyBackup(
  backup: BackupData,
  current: BackupInput,
): ApplyResult {
  const watchlist = mergeWatchlist(current.watchlist, backup.watchlist);
  const alerts = mergeById(current.alerts, backup.alerts);
  const reminders = mergeById(current.reminders, backup.reminders);
  const stockWatches = mergeById(current.stockWatches, backup.stockWatches);

  const settingsApplied = backup.settings !== undefined;

  return {
    watchlist: watchlist.merged,
    alerts: alerts.merged,
    reminders: reminders.merged,
    stockWatches: stockWatches.merged,
    settings: settingsApplied
      ? mergeSettings(current.settings, backup.settings!)
      : current.settings,
    settingsApplied,
    counts: {
      watchlistAdded: watchlist.added,
      watchlistUpdated: watchlist.updated,
      alertsAdded: alerts.added,
      alertsUpdated: alerts.updated,
      remindersAdded: reminders.added,
      remindersUpdated: reminders.updated,
      stockWatchesAdded: stockWatches.added,
      stockWatchesUpdated: stockWatches.updated,
    },
    touchedIds: {
      watchlist: watchlist.touched,
      alerts: alerts.touched,
      reminders: reminders.touched,
      stockWatches: stockWatches.touched,
    },
  };
}
