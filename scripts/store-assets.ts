import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "patchright";
import sharp from "sharp";
import { startSpa } from "./audit-shared";

/**
 * Generates the store image assets from the shipped web export:
 *   store-assets/play/*.png            1080x1920 phone screenshots
 *   store-assets/ios/*.png             1290x2796 iPhone 6.7" screenshots
 *   store-assets/ios-ipad/*.png        2048x2732 iPad 12.9" screenshots
 *   store-assets/play/feature-graphic-1024x500.png
 *
 * The screenshots are seeded with a representative watchlist, never real user
 * data. Review them before uploading. Output is gitignored; run
 * `pnpm build:web && pnpm store:assets` to regenerate.
 */

const OUT = path.resolve("store-assets");

type Device = {
  label: string;
  dir: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
};

const DEVICES: Device[] = [
  { label: "Play phone", dir: "play", width: 540, height: 960, deviceScaleFactor: 2 },
  { label: "iPhone 6.7", dir: "ios", width: 430, height: 932, deviceScaleFactor: 3 },
  { label: "iPad 12.9", dir: "ios-ipad", width: 1024, height: 1366, deviceScaleFactor: 2 },
];

const SCREENS = [
  { slug: "01-home", route: "/" },
  { slug: "02-watchlist", route: "/watchlist" },
  { slug: "03-product", route: "/product/mikrotik-crs326-24s" },
  { slug: "04-alerts", route: "/alerts" },
  { slug: "05-compare", route: "/compare/mikrotik-crs326-24s" },
  { slug: "06-stats", route: "/stats" },
] as const;

/**
 * The onboarding concierge is the only flow that seeds a product together with
 * its sample listings, so screenshots show prices and stock instead of an empty
 * "No data" watchlist. Select two catalog products, skip the optional region
 * choice (USD default), keep the default alerts/stock watches, and finish.
 */
async function seedDemo(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const start = page.getByLabel("Pick products to track");
  if ((await start.count()) === 0) {
    // A reused profile may already be onboarded; the caller still gets a
    // screenshot, but a fresh browser context should always hit the flow.
    return;
  }
  await start.click();
  await page.waitForTimeout(500);
  for (const name of [
    "MikroTik CRS326-24S+2Q+RM",
    "MikroTik CRS804-4DDQ-hRM",
  ]) {
    const select = page.getByLabel(`Select ${name}`);
    if ((await select.count()) > 0) await select.first().click();
    await page.waitForTimeout(150);
  }
  await page.getByLabel("Continue").click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.getByLabel("Continue").click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.getByLabel("Continue").click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.getByLabel("Finish").click({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
}

async function captureDevice(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseUrl: string,
  device: Device,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.deviceScaleFactor,
    colorScheme: "light",
  });
  const page = await context.newPage();
  // The demo listings are deterministic sample data. Let the shell and product
  // images through, but block live price/insight discovery so a background
  // refresh cannot replace the sample prices mid-capture (which made the
  // watchlist card show "No data" and the detail "Out of Stock").
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(baseUrl) && !url.includes("/api/trpc")) {
      return route.continue();
    }
    if (url.includes("/api/trpc/images.")) return route.continue();
    return route.abort();
  });
  await seedDemo(page, baseUrl);

  for (const screen of SCREENS) {
    await page
      .goto(`${baseUrl}${screen.route}`, { waitUntil: "load", timeout: 60_000 })
      .catch(() => {});
    await page.waitForTimeout(1_500);
    if (screen.slug === "03-product") {
      // The hero image is fetched from the API; the first 512px thumbnail can
      // take a few seconds. Capture the settled state, not the placeholder.
      await page
        .waitForFunction(
          () => !document.body.innerText.includes("No image"),
          { timeout: 8_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(500);
    }
    const raw = await page.screenshot({ type: "png" });
    const out = path.join(OUT, device.dir, `${screen.slug}.png`);
    await sharp(raw).flatten({ background: "#FFFFFF" }).png().toFile(out);
    const meta = await sharp(out).metadata();
    console.log(
      `store:assets ${device.dir}/${screen.slug}.png ${meta.width}x${meta.height}`,
    );
  }

  await context.close();
}

async function featureGraphic(): Promise<void> {
  const background = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0F52BA"/>
          <stop offset="1" stop-color="#00A57C"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#g)"/>
      <circle cx="920" cy="60" r="170" fill="#FFFFFF" opacity="0.07"/>
      <circle cx="1000" cy="470" r="230" fill="#FFFFFF" opacity="0.06"/>
    </svg>
  `);

  const mask = Buffer.from(
    `<svg width="196" height="196" xmlns="http://www.w3.org/2000/svg"><rect width="196" height="196" rx="44" fill="#FFFFFF"/></svg>`,
  );
  const icon = await sharp("assets/images/icon.png")
    .resize(196, 196)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const copy = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <text x="300" y="180" font-family="DejaVu Sans, sans-serif" font-size="64" font-weight="700" fill="#FFFFFF">OmniShop</text>
      <text x="302" y="232" font-family="DejaVu Sans, sans-serif" font-size="25" fill="#EAF2FF">Stock and price tracking across 33 distributors</text>
      <g font-family="DejaVu Sans, sans-serif" font-size="18" font-weight="600" fill="#FFFFFF">
        <rect x="302" y="288" width="106" height="42" rx="21" fill="#FFFFFF" opacity="0.16"/>
        <text x="355" y="315" text-anchor="middle">Alerts</text>
        <rect x="420" y="288" width="116" height="42" rx="21" fill="#FFFFFF" opacity="0.16"/>
        <text x="478" y="315" text-anchor="middle">History</text>
        <rect x="548" y="288" width="168" height="42" rx="21" fill="#FFFFFF" opacity="0.16"/>
        <text x="632" y="315" text-anchor="middle">Comparison</text>
      </g>
    </svg>
  `);

  const out = path.join(OUT, "play", "feature-graphic-1024x500.png");
  await sharp(background)
    .composite([
      { input: icon, left: 64, top: 152 },
      { input: copy, left: 0, top: 0 },
    ])
    .flatten({ background: "#0F52BA" })
    .removeAlpha()
    .png()
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(
    `store:assets play/feature-graphic-1024x500.png ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`,
  );
}

async function main(): Promise<void> {
  for (const dir of ["play", "ios", "ios-ipad"]) {
    mkdirSync(path.join(OUT, dir), { recursive: true });
  }
  // Point this at the deployed web app to capture real product images; the
  // local export runs in local-only mode and renders image placeholders.
  const externalBase = process.env.STORE_BASE_URL?.replace(/\/+$/, "");
  const spa = externalBase ? null : await startSpa(process.env.WEB_DIST ?? "dist-web");
  const baseUrl = externalBase ?? spa!.baseUrl;
  const browser = await chromium.launch();
  try {
    for (const device of DEVICES) {
      await captureDevice(browser, baseUrl, device);
    }
    await featureGraphic();
    console.log(`\nstore:assets wrote ${OUT}`);
  } finally {
    await browser.close();
    spa?.close();
  }
}

main().catch((error) => {
  console.error("store:assets failed:", error);
  process.exit(1);
});
