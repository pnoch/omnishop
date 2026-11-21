import { Platform } from "react-native";
import { enableBackgroundService, disableBackgroundService } from "./background-service";
import { isOverlayGranted, requestOverlay } from "@/modules/omnishop-webview-renderer";

export type BackgroundServiceToggleResult =
  | "enabled"
  | "disabled"
  | "permission-required";

// Keeps the native side in sync with the persisted toggle value. Only Android
// renders through the overlay, so only Android needs the display-over-other-apps
// grant; iOS has no such permission and the module reports it as ungranted.
export async function applyBackgroundServiceToggle(
  enabled: boolean,
): Promise<BackgroundServiceToggleResult> {
  if (!enabled) {
    await disableBackgroundService();
    return "disabled";
  }

  if (Platform.OS === "android") {
    try {
      if (!(await isOverlayGranted())) {
        await requestOverlay();
        return "permission-required";
      }
    } catch {
      return "permission-required";
    }
  }

  await enableBackgroundService();
  return "enabled";
}

// Called when the app returns to the foreground. Granting the permission sends
// the user to Android settings, so the toggle cannot finish enabling in place.
export async function resumeBackgroundServiceIfGranted(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    if (!(await isOverlayGranted())) return false;
  } catch {
    return false;
  }
  await enableBackgroundService();
  return true;
}
