import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("UX/UI Phase 1 guards", () => {
  it("product detail has a back control and an honest stock badge", async () => {
    const header = await read("components/product/detail-header.tsx");
    const sticky = await read("components/product/detail-sticky-header.tsx");
    const screen = await read("app/product/[id].tsx");

    expect(header).toContain("onBack");
    expect(header).toContain("stockStatus");
    expect(sticky).toContain("onBack");
    expect(screen).toContain("goBackOrHome(router)");
    expect(screen).toContain("headerStockStatus");
  });

  it("product detail image is contained instead of cropped", async () => {
    const card = await read("components/product/product-info-card.tsx");
    expect(card).toContain('resizeMode="contain"');
    expect(card).toContain("aspectRatio: 16 / 9");
  });
});
