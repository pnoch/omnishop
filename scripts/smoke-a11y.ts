import { chromium } from "patchright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8081";
const ROUTES = [
  ["Home", "/"],
  ["Watchlist", "/watchlist"],
  ["Discover", "/discover"],
  ["Settings", "/settings"],
  ["Rates", "/rates"],
  ["Alerts", "/alerts"],
] as const;

type PageAudit = {
  route: string;
  h1: number;
  headings: number;
  unnamedControls: number;
  imagesMissingAlt: number;
  focusStyle: boolean;
  keyboardFocusMoves: boolean;
};

// Passed as a string so tsx/esbuild does not inject its `__name` helper into
// the browser-evaluated function.
const AUDIT_SCRIPT = `(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden";
  };
  const nameOf = (el) => (
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.textContent ||
    ""
  ).trim();
  const headings = [...document.querySelectorAll("h1,h2,h3,[role='heading']")]
    .filter(visible)
    .map((el) => ({
      level: Number(el.getAttribute("aria-level")) ||
        Number(el.tagName.replace(/[^1-3]/g, "")) || 0,
    }));
  const controls = [...document.querySelectorAll("button,[role='button'],a[href]")]
    .filter(visible);
  const images = [...document.querySelectorAll("img")].filter(visible);
  return {
    h1: headings.filter((h) => h.level === 1).length,
    headings: headings.length,
    unnamedControls: controls.filter((el) => !nameOf(el)).length,
    imagesMissingAlt: images.filter((el) => !el.hasAttribute("alt")).length,
    focusStyle: !!document.getElementById("omnishop-web-polish"),
    keyboardFocusMoves: false,
  };
})()`;

async function auditPage(page: any, route: string): Promise<PageAudit> {
  const result = (await page.evaluate(AUDIT_SCRIPT)) as Omit<
    PageAudit,
    "route"
  >;
  const before = String(
    await page.evaluate(
      "document.activeElement && document.activeElement.tagName || ''",
    ),
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const after = String(
    await page.evaluate(
      "document.activeElement && document.activeElement.tagName || ''",
    ),
  );
  return {
    ...result,
    route,
    keyboardFocusMoves: before !== after && after !== "BODY",
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2_500);

  // Fresh contexts land on onboarding. Skip it so the shell routes are audited.
  const skip = page.getByText("Skip", { exact: true }).first();
  if (await skip.count()) await skip.click();
  await page.waitForTimeout(1_500);

  const audits: PageAudit[] = [];
  for (const [label, route] of ROUTES) {
    await page.goto(new URL(route, BASE_URL).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForTimeout(1_800);
    const audit = await auditPage(page, label);
    audits.push(audit);
  }
  await browser.close();

  let failed = false;
  for (const audit of audits) {
    const issues: string[] = [];
    if (audit.h1 !== 1) issues.push(`expected 1 H1, found ${audit.h1}`);
    if (audit.unnamedControls > 0)
      issues.push(`${audit.unnamedControls} unnamed controls`);
    if (audit.imagesMissingAlt > 0)
      issues.push(`${audit.imagesMissingAlt} images missing alt`);
    if (!audit.focusStyle) issues.push("focus styles not injected");
    if (!audit.keyboardFocusMoves) issues.push("keyboard focus did not move");
    if (issues.length) failed = true;
    console.log(
      `${issues.length ? "FAIL" : "ok  "} ${audit.route.padEnd(10)} ` +
        `h1=${audit.h1} headings=${audit.headings} ` +
        `unnamed=${audit.unnamedControls} imgNoAlt=${audit.imagesMissingAlt}` +
        (issues.length ? ` — ${issues.join("; ")}` : ""),
    );
  }

  if (failed) {
    console.error(`\nAccessibility smoke failed against ${BASE_URL}`);
    process.exit(1);
  }
  console.log(`\nAccessibility smoke passed against ${BASE_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
