// Web-only icon renderer. The default icon-symbol.tsx imports the full
// MaterialIcons font (348 KB) for about 80 glyphs. This component uses the
// generated subset instead, so the web bundle only ships the glyphs in use.
import createIconSet from "@expo/vector-icons/build/createIconSet";
import type { SymbolWeight } from "expo-symbols";
import type { ColorValue, StyleProp, TextStyle } from "react-native";
import { MAPPING, type IconSymbolName } from "./icon-symbol-mapping";

const glyphMap = require("../../assets/icons/omni-icons-map.json") as Record<
  string,
  number
>;
const font = require("../../assets/icons/omni-icons.ttf");
const OmniIcons = createIconSet(glyphMap, "OmniIcons", font);

export type { IconSymbolName } from "./icon-symbol-mapping";

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const resolvedColor =
    typeof color === "number"
      ? `#${color.toString(16).padStart(8, "0")}`
      : (color ?? undefined);
  return (
    <OmniIcons
      color={resolvedColor}
      size={size}
      name={MAPPING[name] ?? "help-outline"}
      style={style}
    />
  );
}
