import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const APP_DIRS = ["app", "components", "hooks", "lib"];
const GESTURE_IMPORT = /from "react-native-gesture-handler(\/[^"]*)?"/;
const REANIMATED_IMPORT = /from "react-native-reanimated"/;

// Reanimated and gesture-handler are large and only needed on native. The web
// entry keeps them out through the platform-split GestureRoot and a
// PanResponder-based swipe row; a direct import in shared UI would pull both
// back into the initial bundle.
describe("web bundle stays free of native animation libraries", () => {
  it("only the native gesture root imports gesture-handler", () => {
    const importers = APP_DIRS.flatMap((dir) =>
      sourceFiles(path.join(process.cwd(), dir)),
    )
      .filter((file) => GESTURE_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));
    expect(importers).toEqual(["components/ui/gesture-root.tsx"]);
  });

  it("no shared module imports reanimated", () => {
    const importers = APP_DIRS.flatMap((dir) =>
      sourceFiles(path.join(process.cwd(), dir)),
    )
      .filter((file) => REANIMATED_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));
    expect(importers).toEqual([]);
  });

  it("the web gesture root is an ordinary view", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/ui/gesture-root.web.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(GESTURE_IMPORT);
    expect(src).not.toMatch(REANIMATED_IMPORT);
  });

  it("the root layout no longer imports reanimated for its side effects", () => {
    const src = readFileSync(path.join(process.cwd(), "app/_layout.tsx"), "utf8");
    expect(src).not.toContain('import "react-native-reanimated"');
  });
});
