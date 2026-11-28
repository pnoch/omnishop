import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { PendingHealthEvent } from "../lib/storage/notifications";

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      store.set(k, v);
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

function healthEvent(overrides: Partial<PendingHealthEvent> = {}): PendingHealthEvent {
  return {
    distributorId: "server2u-my",
    distributorName: "Server2U",
    status: "blocked",
    title: "Distributor blocked",
    body: "Cloudflare challenge",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("notification history claims", () => {
  it("claims an event exactly once", async () => {
    const storage = makeStorage();
    const event = {
      id: "watchlist-drop:p1:10:24:1",
      type: "price_drop" as const,
      title: "Watchlist Drop Alert",
      body: "Test Router dropped 15%",
      productId: "p1",
      triggeredPrice: 85,
      currency: "USD",
      createdAt: 1_700_000_000_000,
    };
    expect(await storage.claimNotificationEvent(event)).toBe(true);
    expect(await storage.claimNotificationEvent(event)).toBe(false);
    const history = await storage.getNotificationHistory();
    expect(history.filter((e) => e.id === event.id)).toHaveLength(1);
  });
});

describe("pending health events buffer", () => {
  it("starts empty", async () => {
    expect(await makeStorage().getPendingHealthEvents()).toEqual([]);
  });

  it("saves and reads back buffered events", async () => {
    const storage = makeStorage();
    const events = [
      healthEvent(),
      healthEvent({ distributorId: "linitx-uk", status: "error", kind: "recovery" }),
    ];
    await storage.savePendingHealthEvents(events);
    expect(await storage.getPendingHealthEvents()).toEqual(events);
  });

  it("overwrites the buffer on save", async () => {
    const storage = makeStorage();
    await storage.savePendingHealthEvents([healthEvent()]);
    await storage.savePendingHealthEvents([healthEvent({ distributorId: "b" })]);
    const pending = await storage.getPendingHealthEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.distributorId).toBe("b");
  });

  it("clears the buffer", async () => {
    const storage = makeStorage();
    await storage.savePendingHealthEvents([healthEvent()]);
    await storage.clearPendingHealthEvents();
    expect(await storage.getPendingHealthEvents()).toEqual([]);
  });
});
