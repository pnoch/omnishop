import { log } from "@shared/log";
import type { AppSettings, TagDefinition } from "../types";
import { generateTagId } from "../tags";
import type { StorageContext } from "./context";
import { quarantinePayload } from "./context";
import type { createWatchlistStorage } from "./watchlist";
import {
  getSecureLlmKey,
  setSecureLlmKey,
} from "../llm-key-store";
import { stripDeviceLocalSettings } from "../settings-privacy";

type WatchlistReader = Pick<
  ReturnType<typeof createWatchlistStorage>,
  "getWatchlist" | "updateWatchlist"
>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  // Daily keeps the welcome screen's alert promise without hourly scraping on a
  // fresh install; users can still choose manual.
  checkInterval: "daily",
  notificationsEnabled: true,
  backgroundServiceEnabled: false,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
  emailAlerts: false,
  webhookAlerts: false,
  alertWebhookUrl: "",
  shippingRegion: "Asia-Pacific",
  webNotificationsEnabled: false,
  watchlistSort: "recent",
  watchlistGroup: "off",
  taxExempt: false,
  includeImportEstimate: false,
};

export function createSettingsStorage(
  ctx: StorageContext,
  watchlist: WatchlistReader,
) {
  const { adapter, KEYS, notify, enqueue } = ctx;
  const { updateWatchlist } = watchlist;
  let keyCleanupScheduled = false;

  // ─── Settings ───────────────────────────────────────────────────────────────

  // Serialized with normal settings writes so a concurrent update cannot be
  // reverted by the cleanup. getSettings() may run inside the queue, so the
  // task is fire-and-forget rather than awaited.
  function scheduleStoredKeyCleanup(): void {
    if (keyCleanupScheduled) return;
    keyCleanupScheduled = true;
    void enqueue(KEYS.SETTINGS, async () => {
      try {
        const current = await getSettings();
        await persistSettings(current, { silent: true });
      } finally {
        keyCleanupScheduled = false;
      }
    }).catch(() => {
      keyCleanupScheduled = false;
    });
  }

  async function persistSettings(
    settings: AppSettings,
    opts?: { silent?: boolean },
  ): Promise<void> {
    // Native writes the key to the OS keychain and keeps it out of plain
    // AsyncStorage. When SecureStore is unavailable (web, tests), keep the
    // legacy copy so the key is never silently lost.
    const secured = await setSecureLlmKey(settings.llmApiKey);
    const toStore = secured ? stripDeviceLocalSettings(settings) : settings;
    await adapter.setItem(KEYS.SETTINGS, JSON.stringify(toStore));
    if (!opts?.silent) notify("settings", "settings");
  }

  async function getSettings(): Promise<AppSettings> {
    let raw: string | null;
    try {
      raw = await adapter.getItem(KEYS.SETTINGS);
    } catch (error) {
      log.warn("[storage] read failed for app_settings", error);
      throw error;
    }
    // A copy: callers may mutate what they read (e.g. `s.displayCurrency = …`
    // then save), which would corrupt the module constant for every user.
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("settings payload must be an object");
      }
      const stored = parsed as Partial<AppSettings>;
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      const secureKey = await getSecureLlmKey();
      if (secureKey) {
        settings.llmApiKey = secureKey;
        // A pre-SecureStore build left a plaintext copy in the JSON. Remove it
        // once the keychain has the value.
        if (stored.llmApiKey) scheduleStoredKeyCleanup();
      } else if (settings.llmApiKey) {
        const secured = await setSecureLlmKey(settings.llmApiKey);
        if (secured) scheduleStoredKeyCleanup();
      }
      return settings;
    } catch {
      await quarantinePayload(adapter, KEYS.SETTINGS, raw);
      log.warn("[storage] quarantined corrupt payload for app_settings");
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function saveSettings(
    settings: AppSettings,
    opts?: { silent?: boolean },
  ): Promise<void> {
    await enqueue(KEYS.SETTINGS, async () => {
      await persistSettings(settings, opts);
    });
  }

  // Serialized read-modify-write. Two quick setting changes that each read the
  // stored value then write the whole object would drop the first change
  // (the second read sees the pre-change snapshot).
  async function updateSettings(
    patch: Partial<AppSettings>,
  ): Promise<AppSettings> {
    let next: AppSettings | null = null;
    await enqueue(KEYS.SETTINGS, async () => {
      const current = await getSettings();
      next = { ...current, ...patch };
      await persistSettings(next, { silent: true });
    });
    notify("settings", "settings");
    return next ?? (await getSettings());
  }

  // ─── Tags ──────────────────────────────────────────────────────────────────

  async function getTagDefinitions(): Promise<Record<string, TagDefinition>> {
    const settings = await getSettings();
    return settings.tagDefinitions ?? {};
  }

  async function saveTagDefinitions(
    defs: Record<string, TagDefinition>,
  ): Promise<void> {
    await updateTagDefinitions(() => defs);
  }

  // Enqueued read-modify-write so concurrent tag mutations never lose
  // definitions. The duplicate check must run inside the queue too.
  async function updateTagDefinitions(
    fn: (
      defs: Record<string, TagDefinition>,
    ) => Record<string, TagDefinition>,
  ): Promise<Record<string, TagDefinition>> {
    let next: Record<string, TagDefinition> = {};
    await enqueue(KEYS.SETTINGS, async () => {
      const settings = await getSettings();
      next = fn(settings.tagDefinitions ?? {});
      await persistSettings({ ...settings, tagDefinitions: next }, { silent: true });
    });
    // Tag definitions live in the settings collection, so the change must mark
    // settings dirty or it never syncs to other devices (products would then
    // reference tag ids that don't exist there and be silently ignored).
    notify("settings", "settings");
    return next;
  }

  async function setProductTags(
    productId: string,
    tags: string[],
  ): Promise<void> {
    const tagsUpdatedAt = new Date().toISOString();
    await updateWatchlist((list) =>
      list.map((p) =>
        p.id === productId ? { ...p, tags, tagsUpdatedAt } : p,
      ),
    );
    notify("watchlist", productId);
  }

  async function addTagsToProducts(
    productIds: string[],
    tagIds: string[],
  ): Promise<void> {
    const tagsUpdatedAt = new Date().toISOString();
    await updateWatchlist((list) => {
      const idSet = new Set(productIds);
      return list.map((p) =>
        idSet.has(p.id)
          ? {
              ...p,
              tags: Array.from(new Set([...(p.tags ?? []), ...tagIds])),
              tagsUpdatedAt,
            }
          : p,
      );
    });
    for (const id of productIds) notify("watchlist", id);
  }

  async function createTag(
    name: string,
    color: string,
  ): Promise<TagDefinition> {
    const trimmed = name.trim();
    let created: TagDefinition | undefined;
    await updateTagDefinitions((defs) => {
      const duplicate = Object.values(defs).some(
        (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A tag with that name already exists");
      created = { id: generateTagId(), name: trimmed, color };
      return { ...defs, [created.id]: created };
    });
    return created!;
  }

  async function renameTag(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    await updateTagDefinitions((defs) => {
      const existing = defs[id];
      if (!existing) return defs;
      const duplicate = Object.values(defs).some(
        (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A tag with that name already exists");
      return { ...defs, [id]: { ...existing, name: trimmed } };
    });
  }

  async function setTagColor(id: string, color: string): Promise<void> {
    await updateTagDefinitions((defs) => {
      const existing = defs[id];
      if (!existing) return defs;
      return { ...defs, [id]: { ...existing, color } };
    });
  }

  async function deleteTag(id: string): Promise<void> {
    let deleted = false;
    await updateTagDefinitions((defs) => {
      if (!defs[id]) return defs;
      deleted = true;
      const rest: Record<string, TagDefinition> = {};
      for (const [key, value] of Object.entries(defs)) {
        if (key !== id) rest[key] = value;
      }
      return rest;
    });
    if (!deleted) return;
    const touched: string[] = [];
    await updateWatchlist((list) =>
      list.map((p) => {
        if (!p.tags?.includes(id)) return p;
        touched.push(p.id);
        // Stamp like setProductTags/addTagsToProducts: without it the tag-LWW
        // merge on another device re-adds the deleted tag (or unions it back).
        return {
          ...p,
          tags: (p.tags ?? []).filter((t) => t !== id),
          tagsUpdatedAt: new Date().toISOString(),
        };
      }),
    );
    for (const productId of touched) notify("watchlist", productId);
  }

  return {
    getSettings,
    saveSettings,
    updateSettings,
    getTagDefinitions,
    saveTagDefinitions,
    setProductTags,
    addTagsToProducts,
    createTag,
    renameTag,
    setTagColor,
    deleteTag,
  };
}
