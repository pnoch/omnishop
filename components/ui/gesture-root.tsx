import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Native keeps the gesture-handler root so native stack gestures work. The web
// build resolves gesture-root.web.tsx, which drops the dependency entirely.
export function GestureRoot({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GestureHandlerRootView style={style}>{children}</GestureHandlerRootView>
  );
}
