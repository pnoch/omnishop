import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "patchright";
import { registerSpa } from "../server/spa";

export const WIDTHS = [320, 390, 768, 1440] as const;

/**
 * Disable CSS transitions/animations before the document runs. A color and
 * layout measurement that lands mid-fade reads a blended value: a selected
 * distribution chip animating from transparent to its color measured 4.09:1
 * against its black label instead of the settled 4.96:1, failing a gate that
 * was actually green. Deterministic measurements need the settled state.
 */
export async function freezeMotion(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const css = "*{transition:none!important;animation:none!important;}";
    const inject = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head?.appendChild(style);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inject, { once: true });
    } else {
      inject();
    }
  });
}

export const ROUTES = [
  "/",
  "/welcome",
  "/watchlist",
  "/discover",
  "/alerts",
  "/rates",
  "/settings",
  "/stats",
  "/health",
  "/health/server2u-my",
  "/sourcing",
  "/build-order",
  "/drops",
  "/available",
  "/diagnostics",
  "/connected-marketplaces",
  "/privacy",
  "/restock-watches",
  "/you",
  "/distributor-analysis",
  "/search",
  "/product/mikrotik-crs326-24s",
  "/compare/mikrotik-crs326-24s",
  "/reset",
  "/reset-password",
  "/verify-email",
  "/w/00000000-0000-4000-8000-000000000000",
] as const;

export function requireWebExport(dist = "dist-web"): string {
  const resolved = path.resolve(dist);
  if (!existsSync(path.join(resolved, "index.html"))) {
    console.error(
      `audit: ${dist}/index.html missing — run \`pnpm build:web\` (or \`pnpm build\`) first`,
    );
    process.exit(1);
  }
  return resolved;
}

/** Serve the exported SPA through the real registerSpa path. */
export async function startSpa(dist = "dist-web"): Promise<{
  baseUrl: string;
  close: () => void;
}> {
  const app = express();
  if (!registerSpa(app, requireWebExport(dist))) {
    throw new Error("registerSpa returned false");
  }
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) {
    throw new Error("audit server did not bind a port");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => server.close(),
  };
}

/**
 * Best-effort state so list/card-heavy screens actually render. The audit still
 * runs if a step fails (e.g. a future copy change), but prints what is missing.
 */
export async function seedApp(
  page: Page,
  baseUrl: string,
  label = "",
): Promise<void> {
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      console.warn(
        `audit${label ? ` ${label}` : ""}: seed step skipped (${name}): ${(error as Error).message}`,
      );
    }
  };

  await step("open home", async () => {
    await page.goto(baseUrl, { waitUntil: "load", timeout: 60_000 });
    // Let the client shell mount before deciding whether onboarding is shown.
    await page.waitForTimeout(2_000);
  });
  await step("dismiss onboarding", async () => {
    const explore = page.getByText("Explore first", { exact: true });
    if ((await explore.count()) > 0) {
      await explore.click({ timeout: 8_000 });
      await page.waitForTimeout(900);
    }
  });
  await step("open search", () =>
    page.getByLabel("Add product").first().click({ timeout: 10_000 }),
  );
  await step("search catalog", async () => {
    await page
      .getByPlaceholder("Search by model number or brand...")
      .fill("CRS326");
    await page.waitForTimeout(700);
    await page
      .getByLabel(/^Add .* to watchlist/)
      .first()
      .click({ timeout: 5_000 });
    await page.waitForTimeout(800);
  });
  await step("open product", async () => {
    await page.goto(`${baseUrl}/watchlist`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.waitForTimeout(600);
    await page
      .getByText("MikroTik CRS326", { exact: false })
      .first()
      .click({ timeout: 5_000 });
    await page.waitForTimeout(800);
  });
  await step("create alert", () =>
    page
      .getByRole("button")
      .filter({ hasText: "Set alert at" })
      .first()
      .click({ timeout: 3_000 }),
  );
  await step("open reminder", () =>
    page.getByLabel("Remind me").first().click({ timeout: 3_000 }),
  );
  await step("save reminder", () =>
    page.getByLabel("Set reminder").click({ timeout: 3_000 }),
  );
}
