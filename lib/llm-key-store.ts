import { log } from "@shared/log";

// The BYO-LLM API key is device-local and never synced. On native it belongs in
// the OS keychain (SecureStore), not in the settings JSON, which is plain
// AsyncStorage. Expo inlines EXPO_OS at build time; tests leave it undefined and
// therefore keep the legacy JSON path, so this module stays importable in Node.
const SECURE_KEY = "omnishop_llm_api_key";

// getSettings runs on many screens; avoid a keychain round-trip on each read.
// This app is the only writer, so the cache cannot go stale behind our back.
let cached: string | undefined;
let loaded = false;

function nativePlatform(): boolean {
  return (
    process.env.EXPO_OS === "ios" || process.env.EXPO_OS === "android"
  );
}

export async function getSecureLlmKey(): Promise<string | undefined> {
  if (!nativePlatform()) return undefined;
  if (loaded) return cached;
  try {
    const store = await import("expo-secure-store");
    const value = await store.getItemAsync(SECURE_KEY);
    cached = value && value.trim() ? value : undefined;
    loaded = true;
    return cached;
  } catch (e) {
    log.warn("[LLM key] SecureStore read failed", e);
    return undefined;
  }
}

/**
 * Persists or deletes the key. Returns true only when SecureStore is available
 * and the operation succeeded, so callers know they may strip the key from the
 * settings JSON. A false result keeps the legacy copy rather than losing it.
 */
export async function setSecureLlmKey(
  value: string | undefined,
): Promise<boolean> {
  if (!nativePlatform()) return false;
  const next = value && value.trim() ? value : undefined;
  if (loaded && cached === next) return true;
  try {
    const store = await import("expo-secure-store");
    if (next) {
      await store.setItemAsync(SECURE_KEY, next);
    } else {
      await store.deleteItemAsync(SECURE_KEY);
    }
    cached = next;
    loaded = true;
    return true;
  } catch (e) {
    log.warn("[LLM key] SecureStore write failed", e);
    return false;
  }
}

export async function clearSecureLlmKey(): Promise<void> {
  await setSecureLlmKey(undefined);
}

export function clearLlmKeyCacheForTests(): void {
  cached = undefined;
  loaded = false;
}
