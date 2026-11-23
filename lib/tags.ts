import { Product, TagDefinition } from "./types";

export const TAG_PALETTE: string[] = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#64748B",
];

export function getTagById(
  defs: Record<string, TagDefinition>,
  id: string,
): TagDefinition | undefined {
  return defs[id];
}

export function tagColor(
  defs: Record<string, TagDefinition>,
  id: string,
): string {
  return getTagById(defs, id)?.color ?? TAG_PALETTE[0];
}

export function nextTagColor(defs: Record<string, TagDefinition>): string {
  const used = new Set(Object.values(defs).map((d) => d.color));
  const free = TAG_PALETTE.find((c) => !used.has(c));
  if (free) return free;
  const last = Object.values(defs).at(-1);
  if (!last) return TAG_PALETTE[0];
  const idx = TAG_PALETTE.indexOf(last.color);
  return TAG_PALETTE[idx === -1 ? 0 : (idx + 1) % TAG_PALETTE.length];
}

export function matchesTagFilterMode(
  product: Product,
  selectedTagIds: string[],
  mode: "any" | "all",
): boolean {
  if (selectedTagIds.length === 0) return true;
  const tags = product.tags ?? [];
  if (mode === "all") return selectedTagIds.every((id) => tags.includes(id));
  const selected = new Set(selectedTagIds);
  return tags.some((id) => selected.has(id));
}

export function matchesTagFilter(
  product: Product,
  selectedTagIds: string[],
): boolean {
  return matchesTagFilterMode(product, selectedTagIds, "any");
}

export function generateTagId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Copy for the tag manager: how many products carry this tag right now. */
export function tagUsageLabel(count: number): string {
  if (count <= 0) return "Not used yet";
  return `Used by ${count} product${count === 1 ? "" : "s"}`;
}

/** Delete confirmation copy that names the blast radius before removal. */
export function tagDeleteMessage(name: string, count: number): string {
  if (count <= 0) return `Delete "${name}"? No products use it.`;
  return `Delete "${name}"? It will be removed from ${count} product${count === 1 ? "" : "s"}. Their other tags stay.`;
}

/** Count of products per tag id, ignoring orphaned ids and duplicates. */
export function countTagUsage(
  products: readonly Pick<Product, "tags">[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    for (const id of new Set(product.tags ?? [])) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
