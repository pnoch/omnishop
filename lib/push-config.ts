import Constants from "expo-constants";

export type PushConfiguration =
  | { kind: "configured"; projectId: string }
  | { kind: "missing-project-id" };

// Expo push registration needs an EAS project id. The build-time override wins
// so a build can point at a different project; otherwise the EAS-linked id is
// used. Blank values are treated as absent so a missing .env entry cannot send an
// empty id to Expo.
export function getPushConfiguration(): PushConfiguration {
  const extra = Constants.expoConfig?.extra as
    | { expoProjectId?: unknown }
    | undefined;
  const candidates = [extra?.expoProjectId, Constants.easConfig?.projectId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return { kind: "configured", projectId: candidate.trim() };
    }
  }
  return { kind: "missing-project-id" };
}
