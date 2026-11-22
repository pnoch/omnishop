import { log } from "@shared/log";
import { getSettings } from "./storage";
import { hasSeenOnboarding } from "./onboarding";

// The OS permission prompt is the first thing a new user would otherwise see,
// on top of the welcome screen. Defer it until onboarding is finished so the
// request follows an explanation of what the app will notify about.
export async function shouldRequestNotificationPermission(): Promise<boolean> {
  try {
    if (!(await hasSeenOnboarding())) return false;
    const settings = await getSettings().catch(() => null);
    if (!settings) return false;
    return Boolean(settings.notificationsEnabled);
  } catch (e) {
    log.error("[Launch] notification permission gate failed", e);
    return false;
  }
}
