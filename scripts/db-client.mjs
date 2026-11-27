import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * MySQL client plumbing shared by `db-backup` and `db-restore`.
 *
 * Prefers locally installed MySQL 8 client tools and falls back to the official
 * `mysql:8.4` image. Credentials go into a 0600 option file (mounted read-only
 * for Docker) rather than the command line, so they do not show up in `ps`.
 */

function hasCommand(name) {
  const result = spawnSync("sh", ["-c", `command -v ${name}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function quoteOption(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isLoopback(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

export function parseMysqlUrl(raw, label) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "mysql:") {
    throw new Error(`${label} must be a mysql:// URL`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) {
    throw new Error(`${label} must include a database name`);
  }
  return {
    host: url.hostname,
    port: url.port || "3306",
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

export function sameDatabase(a, b) {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.database === b.database
  );
}

export function createMysqlTools(rawUrl, label, { interactive = false } = {}) {
  const db = parseMysqlUrl(rawUrl, label);
  const hasClients = hasCommand("mysqldump") && hasCommand("mysql");
  const useDocker = !hasClients;

  const dir = mkdtempSync(path.join(os.tmpdir(), "omnishop-db-"));
  const configPath = path.join(dir, "my.cnf");
  // Docker Desktop on macOS cannot reach the host's loopback; use its bridge
  // name there. Linux uses host networking below.
  const host =
    useDocker && process.platform === "darwin" && isLoopback(db.host)
      ? "host.docker.internal"
      : db.host;
  writeFileSync(
    configPath,
    [
      "[client]",
      `host=${quoteOption(host)}`,
      `port=${db.port}`,
      `user=${quoteOption(db.user)}`,
      `password=${quoteOption(db.password)}`,
      "default-character-set=utf8mb4",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  const dockerBase = ["run", "--rm"];
  if (interactive) dockerBase.push("-i");
  if (process.platform === "linux") dockerBase.push("--network", "host");
  dockerBase.push("-v", `${dir}:/tmp/omnishop-db:ro`, "mysql:8.4");

  const option = useDocker
    ? "--defaults-extra-file=/tmp/omnishop-db/my.cnf"
    : `--defaults-extra-file=${configPath}`;

  return {
    db,
    dumpCommand: useDocker ? "docker" : "mysqldump",
    dumpArgs: useDocker
      ? [...dockerBase, "mysqldump", option]
      : [option],
    mysqlCommand: useDocker ? "docker" : "mysql",
    mysqlArgs: useDocker ? [...dockerBase, "mysql", option] : [option],
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function queryScalar(tools, sql) {
  const result = spawnSync(
    tools.mysqlCommand,
    [...tools.mysqlArgs, "-N", "-B", "-e", sql, tools.db.database],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `mysql query failed: ${(result.stderr || "").trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout.trim();
}
