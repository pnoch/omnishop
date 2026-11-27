import { spawn } from "node:child_process";
import {
  createWriteStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip, gunzipSync } from "node:zlib";
import { createMysqlTools } from "./db-client.mjs";

/**
 * Logical MySQL backup. The dump is schema + data, gzip-compressed and created
 * with mode 0600. It contains user emails and password hashes, so keep it
 * off-site and encrypted; `backups/` is gitignored.
 *
 * Usage:
 *   DATABASE_URL=mysql://... pnpm db:backup [--dir=backups] [--keep=14]
 *
 * Uses local MySQL 8 client tools when installed, otherwise the mysql:8.4
 * Docker image.
 */

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function stamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("db:backup: DATABASE_URL is required");
  process.exit(1);
}

const dir = path.resolve(argValue("--dir", process.env.BACKUP_DIR ?? "backups"));
const keep = Math.max(
  1,
  Number(argValue("--keep", process.env.BACKUP_KEEP ?? "14")) || 14,
);

let tools;
let file;
try {
  tools = createMysqlTools(url, "DATABASE_URL");
  mkdirSync(dir, { recursive: true });
  file = path.join(dir, `omnishop-${stamp()}.sql.gz`);

  const child = spawn(
    tools.dumpCommand,
    [
      ...tools.dumpArgs,
      "--single-transaction",
      "--quick",
      "--no-tablespaces",
      "--routines",
      "--triggers",
      "--set-gtid-purged=OFF",
      "--default-character-set=utf8mb4",
      tools.db.database,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const closed = once(child, "close");
  await pipeline(
    child.stdout,
    createGzip({ level: 9 }),
    createWriteStream(file, { mode: 0o600 }),
  );
  const [code] = await closed;
  if (code !== 0) {
    throw new Error(
      `mysqldump exited ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
    );
  }

  const size = statSync(file).size;
  if (size < 100) {
    throw new Error(`dump is suspiciously small (${size} bytes)`);
  }
  const sql = gunzipSync(readFileSync(file));
  if (!sql.includes("CREATE TABLE")) {
    throw new Error("dump contains no CREATE TABLE statements");
  }
  const tables = (sql.toString("utf8").match(/CREATE TABLE/g) ?? []).length;

  const files = readdirSync(dir)
    .filter((name) => /^omnishop-.*\.sql\.gz$/.test(name))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - keep))) {
    unlinkSync(path.join(dir, old));
  }

  console.log(
    `db:backup: ${path.relative(process.cwd(), file)} (${tables} tables, ${(size / 1024 / 1024).toFixed(2)} MB) from ${tools.db.host}/${tools.db.database}`,
  );
} catch (error) {
  if (file) rmSync(file, { force: true });
  console.error(
    `db:backup failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  tools?.cleanup();
}
