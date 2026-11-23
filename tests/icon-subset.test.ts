import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAPPING } from "../components/ui/icon-symbol-mapping";
import glyphMap from "../assets/icons/omni-icons-map.json";

const ROOT = join(__dirname, "..");

// The web renderer ships only the glyphs named in the mapping. A new mapping
// entry without a regenerated subset renders as a missing glyph, so fail the
// build instead of discovering it on screen.
describe("web icon subset", () => {
  it("contains a glyph for every mapped icon plus the fallback", () => {
    const materials = new Set([...Object.values(MAPPING), "help-outline"]);
    for (const material of materials) {
      expect(glyphMap[material as keyof typeof glyphMap], material).toBeTypeOf(
        "number",
      );
    }
  });

  it("is much smaller than the full MaterialIcons font", () => {
    const subset = statSync(join(ROOT, "assets/icons/omni-icons.ttf")).size;
    const full = statSync(
      join(
        ROOT,
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf",
      ),
    ).size;
    expect(subset).toBeLessThan(64 * 1024);
    expect(subset).toBeLessThan(full / 10);
  });

  it("keeps the web renderer on the subset rather than the full font", () => {
    const src = readFileSync(
      join(ROOT, "components/ui/icon-symbol.web.tsx"),
      "utf8",
    );
    expect(src).toContain("createIconSet");
    expect(src).not.toContain("@expo/vector-icons/MaterialIcons");
  });
});
