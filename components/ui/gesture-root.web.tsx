import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

// The app has no gesture-handler gestures on web (the watchlist swipe uses
// PanResponder), so the root wrapper is a plain view there. This keeps
// react-native-gesture-handler and react-native-reanimated out of the web
// bundle.
export function GestureRoot({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}
