// Storage helpers — uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env";
import { isValidStorageKey } from "./_core/storageProxy";
import { fetchWithTimeout } from "./fetch-timeout";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetchWithTimeout(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetchWithTimeout(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/storage/${key}` };
}

/**
 * Read a stored object's bytes through the Forge presign flow. Used for
 * generated product images (`/storage/<key>`), which the thumbnail pipeline
 * cannot fetch as a normal absolute URL. Returns null when storage is not
 * configured, the key is invalid, or the object exceeds `maxBytes`.
 */
export async function storageGet(
  relKey: string,
  maxBytes = 8 * 1024 * 1024,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  const key = normalizeKey(relKey);
  if (!isValidStorageKey(key)) return null;

  const { forgeUrl, forgeKey } = getForgeConfig();
  try {
    const presignUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
    presignUrl.searchParams.set("path", key);

    const presignResp = await fetchWithTimeout(
      presignUrl,
      { headers: { Authorization: `Bearer ${forgeKey}` } },
      10_000,
    );
    if (!presignResp.ok) return null;
    const { url } = (await presignResp.json()) as { url?: string };
    if (!url) return null;

    const signed = new URL(url);
    if (signed.protocol !== "http:" && signed.protocol !== "https:") return null;

    const objectResp = await fetchWithTimeout(signed, undefined, 15_000);
    if (!objectResp.ok) return null;
    const declared = Number(objectResp.headers.get("content-length") ?? "0");
    if (declared > maxBytes) return null;
    const bytes = Buffer.from(await objectResp.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) return null;
    return {
      bytes,
      contentType:
        objectResp.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch (e) {
    console.warn("[Storage] Failed to read object", e);
    return null;
  }
}
