export interface NotificationPermissionState {
  platform: string;
  status: string | null;
  alertCount: number;
  reminderCount: number;
  watchCount: number;
}

/**
 * Show the "notifications are off" banner only when it can actually explain a
 * silent failure: native, permission denied, and at least one saved alert,
 * reminder, or stock watch that will never fire.
 */
export function shouldShowNotificationPermissionBanner(
  state: NotificationPermissionState,
): boolean {
  if (state.platform === "web") return false;
  if (state.status !== "denied") return false;
  return state.alertCount + state.reminderCount + state.watchCount > 0;
}
