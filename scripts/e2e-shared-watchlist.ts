import { execFileSync } from "node:child_process";
import express from "express";
import { chromium } from "patchright";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { sharedWatchlists, users, watchlistItems } from "../drizzle/schema";
import { closeDb, getDb, getUserByOpenId, upsertUser } from "../server/db";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerApiNoStore } from "../server/api-cache";
import {
  registerBodyParsers,
  registerCors,
  registerSecurityHeaders,
} from "../server/http-middleware";
import { registerSpa } from "../server/spa";

/**
 * Full-stack journey for public share links. Unlike `e2e:smoke` (local-first
 * data), `/w/<token>` is server-backed, so this boots the real tRPC router
 * against the migrated test database, seeds a live and an expired share, and
 * drives the production web export.
 *
 * CI runs it after `db:migrate` with the MySQL service. The web export is built
 * with a loopback API base, which the production client intentionally collapses
 * to same-origin, matching how the app is hosted.
 */

const PORT = Number(process.env.E2E_PORT ?? 8917);
const DIST = "dist-web-e2e";
const OWNER_OPEN_ID = "e2e-shared-watchlist-owner";
const TOKEN = "e2e-shared-live";
const EXPIRED_TOKEN = "e2e-shared-expired";
const PRODUCT_NAME = "E2E Shared Router";

function buildWebExport(): void {
  execFileSync(
    "pnpm",
    ["exec", "expo", "export", "-p", "web", "--output-dir", DIST],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EXPO_PUBLIC_API_BASE_URL: `http://127.0.0.1:${PORT}`,
        EXPO_NO_TELEMETRY: "1",
      },
    },
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "e2e:shared requires DATABASE_URL (CI sets it to the migrated MySQL service)",
    );
  }

  buildWebExport();

  const db = await getDb();
  if (!db) throw new Error("e2e:shared could not connect to DATABASE_URL");

  await upsertUser({ openId: OWNER_OPEN_ID, name: "E2E Share" });
  const owner = await getUserByOpenId(OWNER_OPEN_ID);
  if (!owner) throw new Error("e2e:shared could not create the owner");

  // Clean prior runs; re-seed deterministically.
  await db
    .delete(sharedWatchlists)
    .where(eq(sharedWatchlists.ownerId, owner.id));
  await db.delete(watchlistItems).where(eq(watchlistItems.userId, owner.id));

  const now = new Date().toISOString();
  const product = {
    id: "e2e-shared-product",
    name: PRODUCT_NAME,
    brand: "E2E",
    category: "Networking",
    description: "Shared-watchlist fixture",
    addedAt: now,
    lastRefreshed: now,
    isWatched: true,
    tags: [],
    listings: [
      {
        distributorId: "server2u-my",
        productId: "e2e-shared-product",
        price: 1234,
        currency: "MYR",
        stockStatus: "in_stock",
        url: "https://server2u.com/product",
        lastChecked: now,
        priceHistory: [],
      },
    ],
  };

  await db.insert(watchlistItems).values({
    userId: owner.id,
    productId: product.id,
    data: product,
    updatedAtMs: Date.now(),
  });
  await db.insert(sharedWatchlists).values([
    {
      ownerId: owner.id,
      token: TOKEN,
      title: "E2E Shared List",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      ownerId: owner.id,
      token: EXPIRED_TOKEN,
      title: "E2E Expired List",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  ]);

  const app = express();
  registerSecurityHeaders(app);
  registerCors(app, new Set());
  registerBodyParsers(app);
  registerApiNoStore(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );
  if (!registerSpa(app, DIST)) {
    throw new Error(`e2e:shared: ${DIST}/index.html is missing`);
  }
  const server = app.listen(PORT);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const baseUrl = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  let failed = false;
  const step = async (name: string, run: () => Promise<void>) => {
    process.stdout.write(`e2e:shared ${name} ... `);
    await run();
    console.log("ok");
  };

  try {
    await step("render a live share", async () => {
      await page.goto(`${baseUrl}/w/${TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await page
        .getByText("E2E Shared List", { exact: true })
        .waitFor({ state: "visible", timeout: 20_000 });
      await page
        .getByText(PRODUCT_NAME, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });
      await page
        .getByText("1 product", { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });
    });

    await step("add the shared product locally", async () => {
      await page.getByLabel("Add all to watchlist").click({ timeout: 10_000 });
      await page
        .getByText("Added to watchlist", { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    await step("reject an expired share", async () => {
      const fresh = await context.newPage();
      await fresh.goto(`${baseUrl}/w/${EXPIRED_TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await fresh
        .getByText("Share not found", { exact: true })
        .waitFor({ state: "visible", timeout: 20_000 });
      await fresh.close();
    });

    await step("reject an unknown share", async () => {
      const fresh = await context.newPage();
      await fresh.goto(`${baseUrl}/w/does-not-exist`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await fresh
        .getByText("Share not found", { exact: true })
        .waitFor({ state: "visible", timeout: 20_000 });
      await fresh.close();
    });

    console.log("\ne2e:shared passed");
  } catch (error) {
    failed = true;
    console.error("\ne2e:shared failed:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Explicit deletes first: the owner row may not cascade every table.
    await db
      .delete(sharedWatchlists)
      .where(eq(sharedWatchlists.ownerId, owner.id))
      .catch(() => {});
    await db
      .delete(watchlistItems)
      .where(eq(watchlistItems.userId, owner.id))
      .catch(() => {});
    await db.delete(users).where(eq(users.id, owner.id)).catch(() => {});
    await closeDb().catch(() => {});
    if (failed) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
