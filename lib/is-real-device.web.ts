// The web has no expo-device dependency: push registration is native-only, so
// callers on web never reach this check anyway.
export function isRealDevice(): boolean {
  return false;
}
