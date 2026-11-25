import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { registerRequestLog } from "../server/http-middleware";

let server: ReturnType<ReturnType<typeof express>["listen"]> | null = null;

async function withApp(
  run: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  registerRequestLog(app);
  app.get("/api/test", (_req, res) => res.json({ ok: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/", (_req, res) => res.send("shell"));
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("no port");
  await run(`http://127.0.0.1:${address.port}`);
}

describe("request log middleware", () => {
  afterEach(() => {
    server?.close();
    server = null;
    vi.restoreAllMocks();
  });

  it("adds an id and logs one line for API requests", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await withApp(async (base) => {
      const res = await fetch(`${base}/api/test`);
      expect(res.status).toBe(200);
      const id = res.headers.get("x-request-id");
      expect(id).toBeTruthy();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`^\\[api\\] ${id} GET /api/test 200 \\d+\\.\\d+ms$`),
        ),
      );
    });
  });

  it("preserves a proxy-supplied request id", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await withApp(async (base) => {
      const res = await fetch(`${base}/api/test`, {
        headers: { "x-request-id": "trace-123" },
      });
      expect(res.headers.get("x-request-id")).toBe("trace-123");
    });
  });

  it("does not log health checks or non-API paths", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await withApp(async (base) => {
      await fetch(`${base}/api/health`);
      await fetch(`${base}/`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(log).not.toHaveBeenCalled();
    });
  });
});
