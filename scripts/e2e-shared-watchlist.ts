import { execFileSync } from "node:child_process";
import express from "express";
import { chromium, type Page } from "patchright";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { eq, inArray } from "drizzle-orm";
import {
  sharedWatchlistMembers,
  sharedWatchlists,
  users,
  watchlistItems,
} from "../drizzle/schema";
import { closeDb, getDb, getUserByOpenId, upsertUser } from "../server/db";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";
import { registerApiNoStore } from "../server/api-cache";
import {
  registerBodyParsers,
  registerCors,
  registerSecurityHeaders,
} from "../server/http-middleware";
import { registerSpa } from "../server/spa";
import { COOKIE_NAME } from "../shared/const";

/**
 * Full-stack journey for public share links. Unlike `e2e:smoke` (local-first
 * data), `/w/<token>` is server-backed, so this boots the real tRPC router and
 * auth routes against the migrated test database and drives the production web
 * export.
 *
 * Covers the anonymous read path, local "add all", expired/unknown tokens, the
 * members-only gate, and the authenticated Join → Leave flow. CI runs it after
 * `db:migrate` with the MySQL service. The web export is built with a loopback
 * API base, which the production client intentionally collapses to same-origin,
 * matching how the app is hosted.
 */

const PORT = Number(process.env.E2E_PORT ?? 8917);
const DIST = "dist-web-e2e";
const OWNER_OPEN_ID = "e2e-shared-watchlist-owner";
const MEMBER_OPEN_ID = "e2e-shared-watchlist-member";
const TOKEN = "e2e-shared-live";
const EXPIRED_TOKEN = "e2e-shared-expired";
const MEMBERS_TOKEN = "e2e-shared-members";
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

async function expectText(
  page: Page,
  text: string,
  exact = true,
): Promise<void> {
  await page
    .getByText(text, { exact })
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
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
  await upsertUser({ openId: MEMBER_OPEN_ID, name: "E2E Member" });
  const owner = await getUserByOpenId(OWNER_OPEN_ID);
  const member = await getUserByOpenId(MEMBER_OPEN_ID);
  if (!owner || !member) throw new Error("e2e:shared could not create users");

  const tokens = [TOKEN, EXPIRED_TOKEN, MEMBERS_TOKEN];

  // Clean prior runs; re-seed deterministically.
  await db
    .delete(sharedWatchlistMembers)
    .where(inArray(sharedWatchlistMembers.token, tokens));
  await db
    .delete(sharedWatchlistMembers)
    .where(inArray(sharedWatchlistMembers.userId, [owner.id, member.id]));
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
    {
      ownerId: owner.id,
      token: MEMBERS_TOKEN,
      title: "E2E Members List",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      membersOnly: true,
    },
  ]);
  // Invite the member to the members-only share up front. `join` deliberately
  // cannot bypass that gate, so the invite is the only way in.
  await db
    .insert(sharedWatchlistMembers)
    .values({ token: MEMBERS_TOKEN, userId: member.id, role: "viewer" });

  // Mint a web session for the member; the browser sends it as the app's
  // httpOnly cookie, exercising the same path as a real sign-in.
  const memberSession = await sdk.createSessionToken(MEMBER_OPEN_ID, {
    name: "E2E Member",
  });

  const app = express();
  registerSecurityHeaders(app);
  registerCors(app, new Set());
  registerBodyParsers(app);
  registerApiNoStore(app);
  registerOAuthRoutes(app);
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
  const anonContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const anonPage = await anonContext.newPage();
  const memberContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await memberContext.addCookies([
    {
      name: COOKIE_NAME,
      value: memberSession,
      url: baseUrl,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const memberPage = await memberContext.newPage();

  let failed = false;
  const step = async (name: string, run: () => Promise<void>) => {
    process.stdout.write(`e2e:shared ${name} ... `);
    await run();
    console.log("ok");
  };

  try {
    await step("render a live share", async () => {
      await anonPage.goto(`${baseUrl}/w/${TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await expectText(anonPage, "E2E Shared List");
      await expectText(anonPage, PRODUCT_NAME, false);
      await expectText(anonPage, "1 product", false);
    });

    await step("add the shared product locally", async () => {
      await anonPage
        .getByLabel("Add all to watchlist")
        .click({ timeout: 10_000 });
      await expectText(anonPage, "Added to watchlist", false);
    });

    await step("reject a members-only share for anonymous visitors", async () => {
      const page = await anonContext.newPage();
      await page.goto(`${baseUrl}/w/${MEMBERS_TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await expectText(page, "Share not found");
      await expectText(page, "members-only", false);
      await page.close();
    });

    await step("allow an invited member to view a members-only share", async () => {
      await memberPage.goto(`${baseUrl}/w/${MEMBERS_TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await expectText(memberPage, "E2E Members List");
      await expectText(memberPage, PRODUCT_NAME, false);
    });

    await step("join the share as a signed-in member", async () => {
      await memberPage.goto(`${baseUrl}/w/${TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      const join = memberPage.getByLabel("Join shared watchlist");
      await join.waitFor({ state: "visible", timeout: 20_000 });
      await join.click();
      await expectText(memberPage, "Joined");
      await memberPage
        .getByRole("button", { name: "OK", exact: true })
        .click();
      await memberPage
        .getByLabel("Leave shared watchlist")
        .waitFor({ state: "visible", timeout: 20_000 });
    });

    await step("leave the share again", async () => {
      await memberPage
        .getByLabel("Leave shared watchlist")
        .click({ timeout: 10_000 });
      await expectText(memberPage, "Left");
      await memberPage
        .getByRole("button", { name: "OK", exact: true })
        .click();
      await memberPage
        .getByLabel("Join shared watchlist")
        .waitFor({ state: "visible", timeout: 20_000 });
    });

    await step("reject an expired share", async () => {
      const page = await anonContext.newPage();
      await page.goto(`${baseUrl}/w/${EXPIRED_TOKEN}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await expectText(page, "Share not found");
      await page.close();
    });

    await step("reject an unknown share", async () => {
      const page = await anonContext.newPage();
      await page.goto(`${baseUrl}/w/does-not-exist`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await expectText(page, "Share not found");
      await page.close();
    });

    console.log("\ne2e:shared passed");
  } catch (error) {
    failed = true;
    console.error("\ne2e:shared failed:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await anonContext.close();
    await memberContext.close();
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Explicit deletes first: the owner row may not cascade every table.
    await db
      .delete(sharedWatchlistMembers)
      .where(inArray(sharedWatchlistMembers.token, tokens))
      .catch(() => {});
    await db
      .delete(sharedWatchlistMembers)
      .where(inArray(sharedWatchlistMembers.userId, [owner.id, member.id]))
      .catch(() => {});
    await db
      .delete(sharedWatchlists)
      .where(eq(sharedWatchlists.ownerId, owner.id))
      .catch(() => {});
    await db
      .delete(watchlistItems)
      .where(eq(watchlistItems.userId, owner.id))
      .catch(() => {});
    await db
      .delete(users)
      .where(inArray(users.id, [owner.id, member.id]))
      .catch(() => {});
    await closeDb().catch(() => {});
    if (failed) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
