import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import {
  createMysqlTools,
  parseMysqlUrl,
  queryScalar,
  sameDatabase,
} from "./db-client.mjs";

/**
 * Restore a `db:backup` dump into an explicit target database.
 *
 * Usage:
 *   RESTORE_DATABASE_URL=mysql://... pnpm db:restore backups/omnishop-....sql.gz --yes
 *
 * Safety rails: an explicit target URL, `--yes`, refusal to target the same
 * database as `DATABASE_URL`, and refusal to touch a target that already has
 * tables unless `--force` is passed. Prefer a freshly created scratch database
 * for the restore drill.
 */

const args = process.argv.slice(2);
const dump = args.find((arg) => !arg.startsWith("--"));
const yes = args.includes("--yes");
const force = args.includes("--force");
const usage =
  "Usage: RESTORE_DATABASE_URL=mysql://... pnpm db:restore <dump.sql.gz> --yes [--force]";

if (!dump || !yes) {
  console.error(usage);
  process.exit(1);
}
if (!existsSync(dump) || !statSync(dump).isFile()) {
  console.error(`db:restore: dump not found: ${dump}`);
  process.exit(1);
}
const targetUrl = process.env.RESTORE_DATABASE_URL;
if (!targetUrl) {
  console.error("db:restore: RESTORE_DATABASE_URL is required");
  console.error(usage);
  process.exit(1);
}

let tools;
try {
  tools = createMysqlTools(targetUrl, "RESTORE_DATABASE_URL", {
    interactive: true,
  });

  if (process.env.DATABASE_URL) {
    const source = parseMysqlUrl(process.env.DATABASE_URL, "DATABASE_URL");
    if (sameDatabase(source, tools.db) && !force) {
      throw new Error(
        "RESTORE_DATABASE_URL points at DATABASE_URL; create a scratch database or pass --force",
      );
    }
  }

  const existing = Number(
    queryScalar(
      tools,
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()",
    ),
  );
  if (existing > 0 && !force) {
    throw new Error(
      `target ${tools.db.database} already has ${existing} tables; use a fresh database or pass --force`,
    );
  }
  if (force) {
    console.warn(
      `db:restore: WARNING: --force may drop existing tables in ${tools.db.host}/${tools.db.database}`,
    );
  }

  const child = spawn(
    tools.mysqlCommand,
    [...tools.mysqlArgs, tools.db.database],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const closed = once(child, "close");
  await pipeline(createReadStream(dump), createGunzip(), child.stdin);
  const [code] = await closed;
  if (code !== 0) throw new Error(`mysql exited ${code}`);

  const tables = Number(
    queryScalar(
      tools,
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()",
    ),
  );
  const users = queryScalar(tools, "SELECT COUNT(*) FROM users");
  const prices = queryScalar(tools, "SELECT COUNT(*) FROM price_cache");
  console.log(
    `db:restore: ${tables} tables, users=${users}, price_cache=${prices} in ${tools.db.host}/${tools.db.database}`,
  );
} catch (error) {
  console.error(
    `db:restore failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  tools?.cleanup();
}
