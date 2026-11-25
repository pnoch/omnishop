import { chromium, type Locator, type Page } from "patchright";
import { startSpa } from "./audit-shared";

// User-journey gate: drives the shipped SPA the way a first-time user does.
// Layout/contrast audits only prove the pixels; this proves the flows.

async function expectVisible(locator: Locator, what: string): Promise<void> {
  try {
    await locator.first().waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new Error(`expected ${what} to be visible`);
  }
}

async function runStep(
  name: string,
  run: () => Promise<void>,
): Promise<void> {
  process.stdout.write(`e2e: ${name} ... `);
  await run();
  console.log("ok");
}

async function journey(page: Page, baseUrl: string): Promise<void> {
  await runStep("dismiss onboarding", async () => {
    await page.goto(baseUrl, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await page.getByText("Explore first", { exact: true }).click({ timeout: 15_000 });
  });

  await runStep("add a product from search", async () => {
    await page
      .getByText("Add your first product", { exact: true })
      .first()
      .click({ timeout: 10_000 });
    const search = page.getByPlaceholder("Search by model number or brand...");
    await expectVisible(search, "the catalog search field");
    await search.fill("CRS326");
    const add = page.getByLabel(/^Add .* to watchlist/);
    await expectVisible(add, "an Add to watchlist result");
    await add.first().click();
    // The add handler returns to Home or the watchlist; load the watchlist
    // explicitly so this asserts the write, not a search result on screen.
    await page.goto(`${baseUrl}/watchlist`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await expectVisible(
      page.getByText("MikroTik CRS326", { exact: false }),
      "the product in the watchlist",
    );
  });

  await runStep("open product detail", async () => {
    await page
      .getByText("MikroTik CRS326", { exact: false })
      .first()
      .click();
    await page.waitForURL("**/product/**", { timeout: 20_000 });
    await page.waitForTimeout(800);
  });

  await runStep("create a price alert", async () => {
    const setAlert = page
      .getByRole("button")
      .filter({ hasText: "Set alert at" })
      .first();
    await expectVisible(setAlert, "the suggested-price alert button");
    await setAlert.click();
    await expectVisible(page.getByText(/Alert saved/i), "the alert-saved toast");
  });

  await runStep("snooze the alert for a week", async () => {
    await page.goto(`${baseUrl}/alerts`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    const snooze = page.getByLabel(/^Snooze alert for/);
    await expectVisible(snooze, "the alert's Snooze action");
    await snooze.first().click();
    await expectVisible(page.getByText("Snooze alert"), "the snooze sheet");
    await page.getByLabel(/^7 days/).first().click();
    await expectVisible(
      page.getByText(/snoozed until/i),
      "the snoozed alert state",
    );
  });

  await runStep("delete and undo from the watchlist", async () => {
    await page.goto(`${baseUrl}/watchlist`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    const remove = page.getByLabel("Delete product");
    await expectVisible(remove, "the watchlist delete action");
    await remove.first().click();
    await expectVisible(page.getByText("Remove Product"), "the delete dialog");
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const undo = page.getByLabel("Undo remove");
    await expectVisible(undo, "the undo snackbar");
    await undo.click();
    await expectVisible(
      page.getByText("MikroTik CRS326", { exact: false }),
      "the restored product",
    );
  });
}

async function main(): Promise<void> {
  const spa = await startSpa();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await journey(page, spa.baseUrl);
    console.log("\ne2e:smoke passed");
  } catch (error) {
    console.error("\ne2e:smoke failed:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    spa.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
