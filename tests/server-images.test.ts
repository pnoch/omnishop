import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
  API_BASE_URL: "https://api.example.com",
}));

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import { fetchProductImage } from "../lib/server-images";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockImagesGet(
  handler: () => Promise<
    { imageUrl: string; thumbnailUrl?: string } | null
  >,
) {
  mockedCreateClient.mockReturnValue({
    images: { get: { query: handler } },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("fetchProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImagesGet(async () => ({
      imageUrl: "https://img.example.com/crs804.png",
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the product image URL", async () => {
    const result = await fetchProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
  });

  it("resolves a same-origin thumbnail path against the API base", async () => {
    mockImagesGet(async () => ({
      imageUrl: "https://img.example.com/crs804.png",
      thumbnailUrl: "/api/thumb/mikrotik-crs804-4ddq-hrm/96.webp?v=0123456789abcdef",
    }));
    const result = await fetchProductImage("mikrotik-crs804-4ddq-hrm", {
      thumbWidth: 96,
    });
    expect(result?.thumbnailUrl).toBe(
      "https://api.example.com/api/thumb/mikrotik-crs804-4ddq-hrm/96.webp?v=0123456789abcdef",
    );
  });

  it("resolves a generated /storage path so native can load it", async () => {
    mockImagesGet(async () => ({
      imageUrl: "/storage/generated/product.png",
    }));
    const result = await fetchProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result?.imageUrl).toBe(
      "https://api.example.com/storage/generated/product.png",
    );
  });

  it("passes a distributor page URL when one is available", async () => {
    const query = vi.fn(async () => ({
      imageUrl: "https://img.example.com/real.png",
    }));
    mockedCreateClient.mockReturnValue({
      images: { get: { query } },
    } as unknown as ReturnType<typeof createTRPCClient>);

    await fetchProductImage("mikrotik-crs804-4ddq-hrm", {
      sourceUrls: ["https://server2u.com/product"],
    });

    expect(query).toHaveBeenCalledWith({
      productId: "mikrotik-crs804-4ddq-hrm",
      sourceUrls: ["https://server2u.com/product"],
    });
  });

  it("returns null when there is no image", async () => {
    mockImagesGet(async () => null);
    const result = await fetchProductImage("unknown");
    expect(result).toBeNull();
  });

  it("returns null when the client throws", async () => {
    mockImagesGet(async () => {
      throw new Error("network down");
    });
    const result = await fetchProductImage("a");
    expect(result).toBeNull();
  });

  it("returns null when the request times out", async () => {
    mockImagesGet(
      () =>
        new Promise<never>((_resolve) =>
          setTimeout(() => _resolve({} as never), 50),
        ),
    );
    const result = await fetchProductImage("a", { timeoutMs: 10 });
    expect(result).toBeNull();
  });
});
