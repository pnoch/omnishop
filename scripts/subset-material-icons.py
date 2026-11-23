#!/usr/bin/env python3
"""Build the web icon font subset and its glyph map.

The app uses a fixed set of Material Icons. Shipping the full 350 KB font for
~80 glyphs is wasted transfer, so this script extracts only the codepoints the
mapping names and writes a small TTF plus a matching JSON map.

Run after changing components/ui/icon-symbol-mapping.ts. Requires fonttools:
    python3 -m venv .venv-icons
    .venv-icons/bin/pip install fonttools
    .venv-icons/bin/python scripts/subset-material-icons.py
"""
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
MAPPING_SRC = ROOT / "components/ui/icon-symbol-mapping.ts"
GLYPH_MAP = (
    ROOT
    / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json"
)
SOURCE_FONT = (
    ROOT
    / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"
)
OUT_DIR = ROOT / "assets/icons"
OUT_FONT = OUT_DIR / "omni-icons.ttf"
OUT_MAP = OUT_DIR / "omni-icons-map.json"

text = MAPPING_SRC.read_text()
block = text.split("const MAPPING = {", 1)[1].split("} satisfies IconMapping", 1)[0]
pairs = re.findall(r"""["']?([A-Za-z0-9_.]+)["']?\s*:\s*"([^"]+)\"""", block)
materials = {m for _, m in pairs}
# The component's fallback for a name that type-checking somehow missed.
materials.add("help-outline")

glyphs = json.loads(GLYPH_MAP.read_text())
missing = sorted(m for m in materials if m not in glyphs)
if missing:
    raise SystemExit(f"Unknown Material Icons names: {missing}")

used = {m: glyphs[m] for m in sorted(materials)}
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_MAP.write_text(json.dumps(used, indent=2) + "\n")

font = TTFont(SOURCE_FONT)
subsetter = subset.Subsetter()
subsetter.populate(unicodes=set(used.values()))
subsetter.subset(font)
font.save(OUT_FONT)

src_kb = SOURCE_FONT.stat().st_size / 1024
out_kb = OUT_FONT.stat().st_size / 1024
print(f"{len(used)} glyphs: {src_kb:.0f} KB -> {out_kb:.0f} KB")
