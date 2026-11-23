import AsyncStorage from "@react-native-async-storage/async-storage";

export type MarketplaceSite = "facebook" | "shopee" | "lazada";

export const MARKETPLACE_SITES = [
  "facebook",
  "shopee",
  "lazada",
] as const satisfies readonly MarketplaceSite[];

export const MARKETPLACE_CONNECTIONS_KEY = "marketplace_connections_v1";
export const FACEBOOK_SEARCH_PREFERENCES_KEY = "facebook_search_preferences_v1";

export type ProbeCapability =
  | { kind: "search"; query: string }
  | { kind: "listing"; productId: string }
  | { kind: "navigation" };

export type Verification =
  | { kind: "not_checked" }
  | { kind: "checking" }
  | { kind: "ready"; checkedAt: string; capability: ProbeCapability }
  | { kind: "login_required"; checkedAt: string }
  | { kind: "unverified"; checkedAt: string; reason: string }
  | { kind: "unavailable" };

export type FacebookSearchPreference = {
  requestedArea: string;
  requestedRadiusKm: 10 | 30 | 64;
};

// Hand-written instead of zod: this module is in the web bundle, and importing
// zod for four small shapes added hundreds of KB to the first load.
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseProbeCapability(value: unknown): ProbeCapability | null {
  if (!isRecord(value)) return null;
  if (value.kind === "search" && typeof value.query === "string") {
    return { kind: "search", query: value.query };
  }
  if (value.kind === "listing" && typeof value.productId === "string") {
    return { kind: "listing", productId: value.productId };
  }
  if (value.kind === "navigation") return { kind: "navigation" };
  return null;
}

function parseVerification(value: unknown): Verification | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case "not_checked":
      return { kind: "not_checked" };
    case "checking":
      return { kind: "checking" };
    case "unavailable":
      return { kind: "unavailable" };
    case "login_required":
      return typeof value.checkedAt === "string"
        ? { kind: "login_required", checkedAt: value.checkedAt }
        : null;
    case "unverified":
      return typeof value.checkedAt === "string" && typeof value.reason === "string"
        ? {
            kind: "unverified",
            checkedAt: value.checkedAt,
            reason: value.reason,
          }
        : null;
    case "ready": {
      if (typeof value.checkedAt !== "string") return null;
      const capability = parseProbeCapability(value.capability);
      return capability
        ? { kind: "ready", checkedAt: value.checkedAt, capability }
        : null;
    }
    default:
      return null;
  }
}

function parseConnections(
  value: unknown,
): Partial<Record<MarketplaceSite, Verification>> | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<MarketplaceSite, Verification>> = {};
  for (const site of MARKETPLACE_SITES) {
    if (value[site] === undefined) continue;
    const parsed = parseVerification(value[site]);
    if (!parsed) return null;
    out[site] = parsed;
  }
  return out;
}

function parsePreferences(value: unknown): FacebookSearchPreference | null {
  if (!isRecord(value)) return null;
  const radius = value.requestedRadiusKm;
  if (typeof value.requestedArea !== "string") return null;
  if (radius !== 10 && radius !== 30 && radius !== 64) return null;
  return { requestedArea: value.requestedArea, requestedRadiusKm: radius };
}

export interface ObservedSearchScope {
  area: string | null;
  radiusKm: number | null;
}

export interface MarketplaceSiteConfig {
  readonly label: string;
  readonly homeUrl: string;
  readonly allowedHosts: readonly string[];
}

export const MARKETPLACE_SITE_CONFIG: Record<
  MarketplaceSite,
  MarketplaceSiteConfig
> = {
  facebook: {
    label: "Facebook Marketplace",
    homeUrl: "https://www.facebook.com/marketplace/",
    allowedHosts: ["www.facebook.com", "web.facebook.com", "m.facebook.com"],
  },
  shopee: {
    label: "Shopee Thailand",
    homeUrl: "https://shopee.co.th/",
    allowedHosts: ["shopee.co.th"],
  },
  lazada: {
    label: "Lazada Thailand",
    homeUrl: "https://www.lazada.co.th/",
    allowedHosts: ["www.lazada.co.th"],
  },
};

export const NOT_CHECKED: Verification = { kind: "not_checked" };

export const DEFAULT_FACEBOOK_SEARCH_PREFERENCE: FacebookSearchPreference = {
  requestedArea: "",
  requestedRadiusKm: 64,
};

export function marketplaceHomeUrl(site: MarketplaceSite): string {
  return MARKETPLACE_SITE_CONFIG[site].homeUrl;
}

export function marketplaceAllowedHosts(
  site: MarketplaceSite,
): readonly string[] {
  return MARKETPLACE_SITE_CONFIG[site].allowedHosts;
}

export function isMarketplaceUrlAllowed(
  site: MarketplaceSite,
  raw: string,
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  return marketplaceAllowedHosts(site).includes(url.hostname.toLowerCase());
}

export type MarketplaceConnectionEvent =
  | {
      type: "verification";
      site: MarketplaceSite;
      verification: Verification;
    }
  | { type: "preferences"; preferences: FacebookSearchPreference };

export interface MarketplaceConnectionsService {
  load(): Promise<void>;
  whenIdle(): Promise<void>;
  current(site: MarketplaceSite): Verification;
  preferences(): FacebookSearchPreference;
  setPreferences(preference: FacebookSearchPreference): Promise<void>;
  beginVerification(site: MarketplaceSite): number;
  complete(
    site: MarketplaceSite,
    generation: number,
    verification: Verification,
  ): Promise<void>;
  invalidate(site: MarketplaceSite): Promise<void>;
  subscribe(listener: (event: MarketplaceConnectionEvent) => void): () => void;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cloneVerification(verification: Verification): Verification {
  switch (verification.kind) {
    case "ready":
      return {
        kind: "ready",
        checkedAt: verification.checkedAt,
        capability: { ...verification.capability },
      };
    case "login_required":
      return {
        kind: "login_required",
        checkedAt: verification.checkedAt,
      };
    case "unverified":
      return {
        kind: "unverified",
        checkedAt: verification.checkedAt,
        reason: verification.reason,
      };
    case "checking":
      return { kind: "checking" };
    case "unavailable":
      return { kind: "unavailable" };
    case "not_checked":
      return { kind: "not_checked" };
  }
}

function defaultStates(): Record<MarketplaceSite, Verification> {
  return { facebook: NOT_CHECKED, shopee: NOT_CHECKED, lazada: NOT_CHECKED };
}

class MarketplaceConnectionsServiceImpl implements MarketplaceConnectionsService {
  private states: Record<MarketplaceSite, Verification> = defaultStates();
  // Bumped whenever a new verification starts or a disconnect begins, so a
  // completion from a superseded operation cannot persist or notify.
  private generations: Record<MarketplaceSite, number> = {
    facebook: 0,
    shopee: 0,
    lazada: 0,
  };
  private prefs: FacebookSearchPreference = {
    ...DEFAULT_FACEBOOK_SEARCH_PREFERENCE,
  };
  private listeners = new Set<(event: MarketplaceConnectionEvent) => void>();
  private chain: Promise<unknown> = Promise.resolve();

  async load(): Promise<void> {
    await this.loadConnections();
    await this.loadPreferences();
  }

  private async loadConnections(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(MARKETPLACE_CONNECTIONS_KEY);
    } catch {
      raw = null;
    }
    if (raw == null) return;
    const parsed = parseConnections(parseJson(raw));
    if (!parsed) {
      this.states = defaultStates();
      await this.enqueue(() => this.writeConnections());
      return;
    }
    for (const site of MARKETPLACE_SITES) {
      this.states[site] = parsed[site] ?? NOT_CHECKED;
    }
  }

  private async loadPreferences(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(FACEBOOK_SEARCH_PREFERENCES_KEY);
    } catch {
      raw = null;
    }
    if (raw == null) return;
    const parsed = parsePreferences(parseJson(raw));
    if (!parsed) {
      this.prefs = { ...DEFAULT_FACEBOOK_SEARCH_PREFERENCE };
      await this.enqueue(() => this.writePreferences());
      return;
    }
    this.prefs = parsed;
  }

  current(site: MarketplaceSite): Verification {
    return cloneVerification(this.states[site]);
  }

  preferences(): FacebookSearchPreference {
    return { ...this.prefs };
  }

  async setPreferences(preference: FacebookSearchPreference): Promise<void> {
    const parsed = parsePreferences(preference);
    if (!parsed) return;
    this.prefs = parsed;
    try {
      await this.enqueue(() => this.writePreferences());
    } catch {
      return;
    }
    this.emit({ type: "preferences", preferences: this.preferences() });
  }

  beginVerification(site: MarketplaceSite): number {
    const generation = this.generations[site] + 1;
    this.generations[site] = generation;
    this.states[site] = { kind: "checking" };
    void this.persistVerification(site, generation);
    return generation;
  }

  async complete(
    site: MarketplaceSite,
    generation: number,
    verification: Verification,
  ): Promise<void> {
    if (this.generations[site] !== generation) return;
    const parsed = parseVerification(verification);
    if (!parsed) return;
    this.states[site] = parsed;
    await this.persistVerification(site, generation);
  }

  async invalidate(site: MarketplaceSite): Promise<void> {
    const generation = this.generations[site] + 1;
    this.generations[site] = generation;
    this.states[site] = { kind: "not_checked" };
    await this.persistVerification(site, generation);
  }

  subscribe(listener: (event: MarketplaceConnectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async whenIdle(): Promise<void> {
    await this.chain;
  }

  private async persistVerification(
    site: MarketplaceSite,
    generation: number,
  ): Promise<void> {
    try {
      await this.enqueue(() => this.writeConnections());
    } catch {
      return;
    }
    if (this.generations[site] !== generation) return;
    this.emit({
      type: "verification",
      site,
      verification: this.current(site),
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => {});
    return next;
  }

  private async writeConnections(): Promise<void> {
    await AsyncStorage.setItem(
      MARKETPLACE_CONNECTIONS_KEY,
      JSON.stringify(this.states),
    );
  }

  private async writePreferences(): Promise<void> {
    await AsyncStorage.setItem(
      FACEBOOK_SEARCH_PREFERENCES_KEY,
      JSON.stringify(this.prefs),
    );
  }

  private emit(event: MarketplaceConnectionEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // Isolate a throwing listener from the remaining subscribers.
      }
    }
  }
}

export function createMarketplaceConnectionsService(): MarketplaceConnectionsService {
  return new MarketplaceConnectionsServiceImpl();
}

let shared: MarketplaceConnectionsService | null = null;

export function getMarketplaceConnectionsService(): MarketplaceConnectionsService {
  if (!shared) shared = createMarketplaceConnectionsService();
  return shared;
}
