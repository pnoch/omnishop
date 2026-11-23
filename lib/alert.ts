import { Alert, Platform } from "react-native";
import { enqueueWebAlert } from "./web-alert-store";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS === "web") {
    showWebAlert(title, message, buttons);
    return;
  }
  // Android's Alert supports at most 3 buttons; extras are silently dropped.
  // Fall back to a sequential choice so every option stays reachable.
  if (Platform.OS === "android" && buttons && buttons.length > 3) {
    showAndroidChoice(title, message, buttons);
    return;
  }
  Alert.alert(title, message, buttons);
}

function showAndroidChoice(
  title: string,
  message: string | undefined,
  buttons: AlertButton[],
): void {
  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b !== cancel);
  // Android shows at most 3 buttons and silently drops extras. When a "More…"
  // button is needed it consumes a slot, so show only 2 actions (no cancel) or
  // 1 action + Cancel — otherwise the 4th button (More…) is dropped and the
  // remaining actions become unreachable.
  const needsMore = actions.length > (cancel ? 2 : 3);
  const slots = needsMore ? (cancel ? 1 : 2) : cancel ? 2 : 3;
  const shown = actions.slice(0, slots);
  const remaining = actions.slice(slots);
  const options: AlertButton[] = [...shown];
  if (remaining.length > 0) {
    options.push({
      text: "More…",
      onPress: () => showAndroidChoice(title, message, [...remaining, ...(cancel ? [cancel] : [])]),
    });
  } else if (cancel) {
    options.push(cancel);
  }
  Alert.alert(title, message, options);
}

function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (typeof window === "undefined") return;
  enqueueWebAlert(title, message, buttons);
}
