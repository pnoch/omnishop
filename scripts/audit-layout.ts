import { chromium } from "patchright";
import { ROUTES, WIDTHS, seedApp, startSpa } from "./audit-shared";

// Browser-side check, passed as a string so tsx/esbuild does not inject its
// `__name` helper into the page (it is not defined in the browser).
const AUDIT_LAYOUT = `
(() => {
  const viewportWidth = window.innerWidth;
  const problems = [];
  const seen = new Map();

  const clippedHorizontally = (el) => {
    const rect = el.getBoundingClientRect();
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === "hidden" || style.overflowX === "clip") {
        const box = node.getBoundingClientRect();
        if (rect.right > box.right + 1 || rect.left < box.left - 1) return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const controls = document.querySelectorAll(
    'button, [role="button"], a, [role="tab"], [role="checkbox"], [role="radio"]',
  );
  for (const el of Array.from(controls)) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue;
    const label = (el.getAttribute("aria-label") || el.textContent || "")
      .replace(/\\s+/g, " ")
      .trim();
    if (!label) continue;

    seen.set(label, (seen.get(label) || 0) + 1);
    if (rect.left < -1 || rect.right > viewportWidth + 1) {
      problems.push("off-screen: " + label);
    } else if (clippedHorizontally(el)) {
      problems.push("clipped: " + label);
    }
    const exempt =
      el.closest && el.closest('[data-audit-exempt~="small-target"]');
    if (!exempt && (rect.width < 40 || rect.height < 40)) {
      problems.push(
        "small target " + Math.round(rect.width) + "x" + Math.round(rect.height) + ": " + label,
      );
    }
  }

  for (const [label, count] of seen) {
    if (count > 1) problems.push("duplicate name x" + count + ": " + label);
  }

  const overflow = document.documentElement.scrollWidth - viewportWidth;
  if (overflow > 1) problems.push("horizontal overflow: " + overflow + "px");

  return Array.from(new Set(problems));
})()
`;

async function main() {
  const spa = await startSpa();
  const browser = await chromium.launch();
  let failures = 0;

  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      await seedApp(page, spa.baseUrl, `${width}px`);

      for (const route of ROUTES) {
        await page
          .goto(`${spa.baseUrl}${route}`, {
            waitUntil: "networkidle",
            timeout: 45_000,
          })
          .catch(() => {});
        await page.waitForTimeout(500);
        const problems = (await page
          .evaluate(AUDIT_LAYOUT)
          .catch((error: Error) => [`audit failed: ${error.message}`])) as string[];
        if (problems.length > 0) {
          failures += problems.length;
          console.error(`\n${width}px ${route}`);
          for (const problem of problems) console.error(`  - ${problem}`);
        }
      }
      await context.close();
      console.log(`audit:layout ${width}px done`);
    }
  } finally {
    await browser.close();
    spa.close();
  }

  if (failures > 0) {
    console.error(`\naudit:layout failed with ${failures} problem(s)`);
    process.exit(1);
  }
  console.log("\naudit:layout passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
