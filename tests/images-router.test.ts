import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

vi.mock("../server/product-images", () => ({
  getProductImage: vi.fn(),
  readCachedProductImageUrl: vi.fn(),
  listProductsMissingImage: vi.fn(),
  clearImagesForTests: vi.fn(),
}));

vi.mock("../server/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { getProductImage, readCachedProductImageUrl } from "../server/product-images";
import { checkRateLimit } from "../server/rate-limit";
const mockedGetProductImage = vi.mocked(getProductImage);
const mockedReadCached = vi.mocked(readCachedProductImageUrl);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("images router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadCached.mockResolvedValue(null);
  });

  it("returns the product image URL", async () => {
    mockedGetProductImage.mockResolvedValue({
      imageUrl: "https://img.example.com/crs804.png",
    });
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({
      productId: "mikrotik-crs804-4ddq-hrm",
    });
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGetProductImage).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
      undefined,
      undefined,
    );
  });

  it("passes product-page candidates through to the resolver", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await caller.images.get({
      productId: "mikrotik-crs804-4ddq-hrm",
      sourceUrls: ["https://server2u.com/shop/crs804"],
    });
    expect(mockedGetProductImage).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
      ["https://server2u.com/shop/crs804"],
      undefined,
    );
  });

  it("passes a thumbnail width through", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await caller.images.get({
      productId: "mikrotik-crs804-4ddq-hrm",
      thumbWidth: 96,
    });
    expect(mockedGetProductImage).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
      undefined,
      96,
    );
  });

  it("accepts the hero width", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await caller.images.get({
      productId: "mikrotik-crs804-4ddq-hrm",
      thumbWidth: 512,
    });
    expect(mockedGetProductImage).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
      undefined,
      512,
    );
    await expect(
      caller.images.get({
        productId: "mikrotik-crs804-4ddq-hrm",
        thumbWidth: 513,
      }),
    ).rejects.toThrow();
  });

  it("charges discovery only when the image is not cached", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());

    mockedReadCached.mockResolvedValue("https://img.example.com/x.png");
    await caller.images.get({ productId: "mikrotik-crs804-4ddq-hrm" });
    expect(mockedCheckRateLimit.mock.calls.map((call) => call[1])).toEqual([
      "images.get",
    ]);

    mockedCheckRateLimit.mockClear();
    mockedReadCached.mockResolvedValue(null);
    await caller.images.get({ productId: "mikrotik-crs804-4ddq-hrm" });
    expect(mockedCheckRateLimit.mock.calls.map((call) => call[1])).toEqual([
      "images.get",
      "images.resolve",
    ]);
  });

  it("returns null when there is no image", async () => {
    mockedGetProductImage.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.images.get({ productId: "unknown" });
    expect(result).toBeNull();
  });

  it("works without authentication (public procedure)", async () => {
    mockedGetProductImage.mockResolvedValue({ imageUrl: "x" });
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.images.get({ productId: "a" })).resolves.toEqual({
      imageUrl: "x",
    });
  });
});
