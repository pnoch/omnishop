// Guards the initial web payload. The mobile bundle dropped from ~1,027 KB to
// ~589 KB gzip during the 5.32.x performance work; a stray dependency (a parser,
// animation library, zod, etc.) would silently undo it. Measure the two chunks
// every page load needs (common + entry) and fail with a clear overage.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const dir = path.resolve(process.env.WEB_DIST ?? "dist-web/_expo/static/js/web");
const budgets = {
  common: Number(process.env.BUDGET_COMMON_KB ?? 360),
  entry: Number(process.env.BUDGET_ENTRY_KB ?? 320),
  total: Number(process.env.BUDGET_TOTAL_KB ?? 700),
};

function find(prefix) {
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    console.error(`budget:web: ${dir} missing — run \`pnpm build:web\` first`);
    process.exit(1);
  }
  return files.filter(
    (file) => file.startsWith(prefix) && file.endsWith(".js"),
  );
}

function gzipKb(file) {
  const raw = readFileSync(path.join(dir, file));
  return Math.ceil(gzipSync(raw, { level: 9 }).length / 1024);
}

const commonFiles = find("__common-");
const entryFiles = find("entry-");
if (commonFiles.length !== 1 || entryFiles.length !== 1) {
  console.error(
    `budget:web: expected one common and one entry chunk, found ${commonFiles.length} / ${entryFiles.length}`,
  );
  process.exit(1);
}

const sizes = {
  common: gzipKb(commonFiles[0]),
  entry: gzipKb(entryFiles[0]),
};
sizes.total = sizes.common + sizes.entry;

let failed = false;
for (const [name, budget] of Object.entries(budgets)) {
  const size = sizes[name];
  const status = size > budget ? "FAIL" : "ok  ";
  if (size > budget) failed = true;
  console.log(
    `${status} ${name.padEnd(7)} ${String(size).padStart(4)} KB gzip (budget ${budget} KB)`,
  );
}

if (failed) {
  console.error(
    "\nbudget:web: initial web JS exceeds its budget. Find the new import before raising a number.",
  );
  process.exit(1);
}
console.log("\nbudget:web passed");
