import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/storage/settings";

const secure = vi.hoisted(() => ({
  map: new Map<string, string>(),
  failWrites: false,
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secure.map.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (secure.failWrites) throw new Error("keychain denied");
    secure.map.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secure.map.delete(key);
  },
}));

import { createStorage } from "../lib/storage";
import {
  clearLlmKeyCacheForTests,
  getSecureLlmKey,
  setSecureLlmKey,
} from "../lib/llm-key-store";

function adapter() {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: async (key: string) => raw.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      raw.set(key, value);
    },
    removeItem: async (key: string) => {
      raw.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      for (const key of keys) raw.delete(key);
    },
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const SETTINGS_KEY = "app_settings";
const SECURE_KEY = "omnishop_llm_api_key";

describe("BYO LLM key storage", () => {
  beforeEach(() => {
    process.env.EXPO_OS = "ios";
    secure.map.clear();
    secure.failWrites = false;
    clearLlmKeyCacheForTests();
  });

  afterEach(() => {
    delete process.env.EXPO_OS;
  });

  it("writes the key to SecureStore and strips it from settings JSON", async () => {
    const store = adapter();
    const storage = createStorage(store);
    await storage.saveSettings(settings({ llmApiKey: "sk-secure" }));

    expect(secure.map.get(SECURE_KEY)).toBe("sk-secure");
    const raw = JSON.parse(store.raw.get(SETTINGS_KEY)!) as AppSettings;
    expect(raw.llmApiKey).toBeUndefined();
    expect((await storage.getSettings()).llmApiKey).toBe("sk-secure");
  });

  it("migrates a plaintext key left by an older build", async () => {
    const store = adapter();
    store.raw.set(
      SETTINGS_KEY,
      JSON.stringify(settings({ llmApiKey: "sk-legacy" })),
    );
    const storage = createStorage(store);

    expect((await storage.getSettings()).llmApiKey).toBe("sk-legacy");
    expect(secure.map.get(SECURE_KEY)).toBe("sk-legacy");
    await vi.waitFor(() => {
      const raw = JSON.parse(store.raw.get(SETTINGS_KEY)!) as AppSettings;
      expect(raw.llmApiKey).toBeUndefined();
    });
  });

  it("keeps the key in JSON on web, where SecureStore is unavailable", async () => {
    process.env.EXPO_OS = "web";
    const store = adapter();
    const storage = createStorage(store);
    await storage.saveSettings(settings({ llmApiKey: "sk-web" }));

    expect(secure.map.size).toBe(0);
    const raw = JSON.parse(store.raw.get(SETTINGS_KEY)!) as AppSettings;
    expect(raw.llmApiKey).toBe("sk-web");
  });

  it("does not lose the key when the keychain write fails", async () => {
    secure.failWrites = true;
    const store = adapter();
    const storage = createStorage(store);
    await storage.saveSettings(settings({ llmApiKey: "sk-fallback" }));

    const raw = JSON.parse(store.raw.get(SETTINGS_KEY)!) as AppSettings;
    expect(raw.llmApiKey).toBe("sk-fallback");
  });

  it("deletes the key from SecureStore when settings clear it", async () => {
    await setSecureLlmKey("sk-old");
    expect(await getSecureLlmKey()).toBe("sk-old");

    const storage = createStorage(adapter());
    await storage.saveSettings(settings());
    expect(secure.map.has(SECURE_KEY)).toBe(false);
  });
});
