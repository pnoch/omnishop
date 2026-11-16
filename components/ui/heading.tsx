import { Platform, Text, type TextProps } from "react-native";

export type HeadingLevel = 1 | 2 | 3;

/**
 * Web needs a real heading role and level; React Native's `accessibilityRole`
 * maps every header to h1, which made Settings expose fourteen H1s.
 */
export function Heading({
  level = 2,
  ...props
}: TextProps & { level?: HeadingLevel }) {
  return (
    <Text
      {...(Platform.OS === "web"
        ? ({ role: "heading", "aria-level": level } as object)
        : { accessibilityRole: "header" })}
      {...props}
    />
  );
}
