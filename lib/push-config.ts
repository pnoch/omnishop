import Constants from "expo-constants";
import { Platform } from "react-native";

export type PushConfiguration =
  | { kind: "configured"; projectId: string }
  | { kind: "missing-project-id" }
  | { kind: "missing-native-config" };

// Expo push registration needs an EAS project id. The build-time override wins
// so a build can point at a different project; otherwise the EAS-linked id is
// used. Blank values are treated as absent so a missing .env entry cannot send an
// empty id to Expo.
export function getPushConfiguration(): PushConfiguration {
  const extra = Constants.expoConfig?.extra as
    | { expoProjectId?: unknown; googleServicesFilePresent?: unknown }
    | undefined;
  const projectId = firstNonBlank(
    extra?.expoProjectId,
    Constants.easConfig?.projectId,
  );
  if (!projectId) return { kind: "missing-project-id" };
  // Android needs the Firebase config to obtain a device token. `undefined`
  // means the build predates this flag, so do not block it.
  if (Platform.OS === "android" && extra?.googleServicesFilePresent === false) {
    return { kind: "missing-native-config" };
  }
  return { kind: "configured", projectId };
}

function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
