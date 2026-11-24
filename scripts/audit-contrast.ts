import { chromium } from "patchright";
import { seedApp, startSpa } from "./audit-shared";

const ROUTES = [
  "/",
  "/watchlist",
  "/alerts",
  "/settings",
  "/rates",
  "/stats",
  "/discover",
] as const;

// Browser-side WCAG AA check, passed as a string so tsx/esbuild does not inject
// its `__name` helper into the page.
const AUDIT_CONTRAST = `
(() => {
  const parse = (value) => {
    const match = value.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(",").map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const luminance = (color) => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const background = (el) => {
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    let node = el;
    while (node && node !== document.documentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0) {
        bg = blend(color, bg);
        if (color.a >= 1) break;
      }
      node = node.parentElement;
    }
    return bg;
  };

  const failures = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const text = Array.from(el.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join("")
      .trim();
    if (!text) continue;
    const style = getComputedStyle(el);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      Number.parseFloat(style.opacity) === 0
    ) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const fg = parse(style.color);
    if (!fg) continue;
    const bg = background(el);
    const effective = fg.a < 1 ? blend(fg, bg) : fg;
    const contrast = ratio(effective, bg);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    // Icon-font glyphs are graphics: WCAG 1.4.11 needs 3:1, not 4.5:1.
    const iconOnly = /^[\\uE000-\\uF8FF\\s]+$/.test(text);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = iconOnly || large ? 3 : 4.5;
    if (contrast + 0.01 < need) {
      failures.push({
        text: text.slice(0, 40),
        ratio: Math.round(contrast * 100) / 100,
        need: need,
        size: Math.round(size),
      });
    }
  }

  const seen = new Set();
  return failures
    .filter((failure) => {
      const key = failure.text + "|" + failure.ratio + "|" + failure.size;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 15);
})()
`;

async function main() {
  const spa = await startSpa();
  const browser = await chromium.launch();
  let failures = 0;

  try {
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 900 },
        colorScheme: scheme,
      });
      const page = await context.newPage();
      await seedApp(page, spa.baseUrl, scheme);

      for (const route of ROUTES) {
        await page
          .goto(`${spa.baseUrl}${route}`, {
            waitUntil: "networkidle",
            timeout: 45_000,
          })
          .catch(() => {});
        await page.waitForTimeout(500);
        const problems = (await page
          .evaluate(AUDIT_CONTRAST)
          .catch((error: Error) => [
            { text: `audit failed: ${error.message}`, ratio: 0, need: 4.5, size: 0 },
          ])) as {
          text: string;
          ratio: number;
          need: number;
          size: number;
        }[];
        if (problems.length > 0) {
          failures += problems.length;
          console.error(`\n${scheme} ${route}`);
          for (const problem of problems) {
            console.error(
              `  - ${problem.ratio}:1 (needs ${problem.need}:1, ${problem.size}px) ${JSON.stringify(problem.text)}`,
            );
          }
        }
      }
      await context.close();
      console.log(`audit:contrast ${scheme} done`);
    }
  } finally {
    await browser.close();
    spa.close();
  }

  if (failures > 0) {
    console.error(`\naudit:contrast failed with ${failures} problem(s)`);
    process.exit(1);
  }
  console.log("\naudit:contrast passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
